const pool = require('../db/pool');
const { processBlock } = require('./block-processor');

/**
 * Historical sync: fetch all blocks from pruning point to tip.
 * Uses GetBlocks RPC in batches.
 */
async function syncHistorical(wrpcClient) {
    console.log('[Indexer] Starting historical sync...');

    // Get current DAG info
    const dagInfo = await wrpcClient.getBlockDagInfo();
    const tipHash = dagInfo.tipHashes?.[0];
    const pruningPoint = dagInfo.pruningPointHash;
    const totalBlocks = parseInt(dagInfo.blockCount || '0', 10);

    // Check last indexed position
    const stateResult = await pool.query(
        `SELECT value FROM indexer_state WHERE key = 'last_indexed_hash'`
    );
    let lowHash = stateResult.rows.length > 0 ? stateResult.rows[0].value : pruningPoint;

    if (!lowHash) {
        console.log('[Indexer] No pruning point available, starting from sink');
        const sinkResult = await wrpcClient.getSink();
        lowHash = sinkResult.sink;
    }

    let indexed = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const result = await wrpcClient.getBlocks(lowHash, true, true);
            const blocks = result.blocks || [];
            const blockHashes = result.blockHashes || [];

            if (blocks.length === 0) {
                hasMore = false;
                break;
            }

            // Process each block in a transaction
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                for (const block of blocks) {
                    await processBlock(block, client);
                    indexed++;
                }

                // Update checkpoint
                const lastHash = blockHashes[blockHashes.length - 1] || blocks[blocks.length - 1]?.verboseData?.hash;
                if (lastHash) {
                    await client.query(
                        `INSERT INTO indexer_state (key, value) VALUES ('last_indexed_hash', $1)
                         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
                        [lastHash]
                    );
                    lowHash = lastHash;
                }

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }

            if (indexed % 100 === 0) {
                const pct = totalBlocks > 0 ? ((indexed / totalBlocks) * 100).toFixed(1) : '?';
                console.log(`[Indexer] Syncing... ${indexed.toLocaleString()} blocks (${pct}%)`);
            }

            // If we got fewer blocks than expected, we've caught up
            if (blocks.length < 50) {
                hasMore = false;
            }
        } catch (err) {
            if (err.message?.includes('timeout')) {
                console.warn('[Indexer] Batch timeout, retrying...');
                continue;
            }
            throw err;
        }
    }

    console.log(`[Indexer] Historical sync complete. Indexed ${indexed.toLocaleString()} blocks.`);
    return indexed;
}

module.exports = { syncHistorical };
