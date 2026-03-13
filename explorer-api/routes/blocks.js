const { Router } = require('express');
const pool = require('../db/pool');

function createBlocksRoutes(wrpcClient) {
    const router = Router();

    // GET /blocks?limit=50&offset=0
    router.get('/', async (req, res) => {
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
        const offset = parseInt(req.query.offset || '0', 10);

        try {
            const result = await pool.query(
                `SELECT hash, blue_score AS "blueScore", timestamp, daa_score AS "daaScore",
                        block_height AS "blockHeight", tx_count AS "txCount",
                        is_chain_block AS "isChainBlock", difficulty
                 FROM blocks ORDER BY blue_score DESC LIMIT $1 OFFSET $2`,
                [limit, offset]
            );
            res.json(result.rows);
        } catch (err) {
            // Fallback to wRPC if DB is empty
            try {
                const dagInfo = await wrpcClient.getBlockDagInfo();
                const data = await wrpcClient.getBlocks(dagInfo.tipHashes?.[0] || '', true, true);
                res.json((data.blocks || []).map(b => ({
                    hash: b.verboseData?.hash,
                    blueScore: b.verboseData?.blueScore,
                    timestamp: b.header?.timestamp,
                    txCount: (b.transactions || []).length
                })));
            } catch (wrpcErr) {
                res.status(503).json({ error: 'Service unavailable', detail: wrpcErr.message });
            }
        }
    });

    // GET /blocks/:hash
    router.get('/:hash', async (req, res) => {
        const { hash } = req.params;

        // Try DB first
        try {
            const blockResult = await pool.query(
                `SELECT raw_json FROM blocks WHERE hash = $1`, [hash]
            );
            if (blockResult.rows.length > 0 && blockResult.rows[0].raw_json) {
                return res.json(blockResult.rows[0].raw_json);
            }
        } catch (err) {
            // Fall through to wRPC
        }

        // Fallback to wRPC
        try {
            const data = await wrpcClient.getBlock(hash, true);
            res.json(data);
        } catch (err) {
            res.status(404).json({ detail: 'Block not found' });
        }
    });

    return router;
}

module.exports = createBlocksRoutes;
