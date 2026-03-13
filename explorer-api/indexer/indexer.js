const { processBlock } = require('./block-processor');
const { syncHistorical } = require('./sync');
const pool = require('../db/pool');

/**
 * Main indexer: syncs historical blocks then subscribes to new blocks.
 * @param {import('../wrpc-client').WrpcClient} wrpcClient
 * @param {import('socket.io').Server} io - Socket.io server for pushing updates
 */
async function startIndexer(wrpcClient, io) {
    console.log('[Indexer] Starting...');

    // 1. Historical sync
    try {
        await syncHistorical(wrpcClient);
    } catch (err) {
        console.error('[Indexer] Historical sync failed:', err.message);
        console.log('[Indexer] Continuing with realtime indexing...');
    }

    // 2. Subscribe to new blocks
    try {
        await wrpcClient.subscribeBlockAdded();
        console.log('[Indexer] Subscribed to NotifyBlockAdded');
    } catch (err) {
        console.error('[Indexer] Failed to subscribe to blocks:', err.message);
        return;
    }

    // 3. Subscribe to DAA score changes for bluescore updates
    try {
        await wrpcClient.subscribeSinkBlueScoreChanged();
        console.log('[Indexer] Subscribed to NotifySinkBlueScoreChanged');
    } catch (err) {
        console.warn('[Indexer] Failed to subscribe to blue score:', err.message);
    }

    // 4. Handle new blocks
    wrpcClient.on('block-added', async (data) => {
        try {
            const block = data.block;
            if (!block) return;

            const result = await processBlock(block);

            // Update checkpoint
            if (result.blockHash) {
                await pool.query(
                    `INSERT INTO indexer_state (key, value) VALUES ('last_indexed_hash', $1)
                     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
                    [result.blockHash]
                );
            }

            // Push to connected frontend clients
            if (io) {
                io.emit('new-block', {
                    hash: result.blockHash,
                    blueScore: result.blueScore,
                    txCount: result.txCount,
                    timestamp: block.header?.timestamp
                });
            }
        } catch (err) {
            console.error('[Indexer] Error processing new block:', err.message);
        }
    });

    // 5. Handle blue score changes
    wrpcClient.on('sink-blue-score-changed', (data) => {
        if (io && data.sinkBlueScore !== undefined) {
            io.emit('bluescore', { blueScore: parseInt(data.sinkBlueScore, 10) });
        }
    });

    console.log('[Indexer] Realtime indexing active');
}

module.exports = { startIndexer };
