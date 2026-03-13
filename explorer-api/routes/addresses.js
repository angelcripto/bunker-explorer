const { Router } = require('express');
const pool = require('../db/pool');

function createAddressesRoutes(wrpcClient) {
    const router = Router();

    // GET /addresses/:addr/balance
    router.get('/:addr/balance', async (req, res) => {
        const { addr } = req.params;

        // Try wRPC first (real-time)
        try {
            const data = await wrpcClient.getBalanceByAddress(addr);
            res.json({ balance: parseInt(data.balance || '0', 10) });
        } catch (err) {
            // Fallback to DB
            try {
                const result = await pool.query(
                    `SELECT balance FROM addresses WHERE address = $1`, [addr]
                );
                if (result.rows.length > 0) {
                    return res.json({ balance: parseInt(result.rows[0].balance, 10) });
                }
                res.json({ balance: 0 });
            } catch (dbErr) {
                res.status(503).json({ error: 'Service unavailable' });
            }
        }
    });

    // GET /addresses/:addr/utxos
    router.get('/:addr/utxos', async (req, res) => {
        const { addr } = req.params;

        try {
            const data = await wrpcClient.getUtxosByAddresses([addr]);
            res.json(data.entries || []);
        } catch (err) {
            res.status(503).json({ error: 'Node offline', detail: err.message });
        }
    });

    // GET /addresses/:addr/full-transactions?limit=20&offset=0
    router.get('/:addr/full-transactions', async (req, res) => {
        const { addr } = req.params;
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const offset = parseInt(req.query.offset || '0', 10);

        try {
            // Get tx IDs where this address appears in inputs or outputs
            const result = await pool.query(
                `SELECT DISTINCT t.raw_json, t.block_time
                 FROM transactions t
                 WHERE t.tx_id IN (
                     SELECT tx_id FROM transaction_inputs WHERE address = $1
                     UNION
                     SELECT tx_id FROM transaction_outputs WHERE address = $1
                 )
                 ORDER BY t.block_time DESC
                 LIMIT $2 OFFSET $3`,
                [addr, limit, offset]
            );

            res.json(result.rows.map(r => r.raw_json));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /addresses/:addr/transactions-count
    router.get('/:addr/transactions-count', async (req, res) => {
        const { addr } = req.params;

        try {
            const result = await pool.query(
                `SELECT tx_count AS "total" FROM addresses WHERE address = $1`, [addr]
            );
            if (result.rows.length > 0) {
                return res.json({ total: result.rows[0].total });
            }
            res.json({ total: 0 });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /addresses/:addr/name (stub)
    router.get('/:addr/name', async (req, res) => {
        res.json({ address: req.params.addr, name: null });
    });

    return router;
}

module.exports = createAddressesRoutes;
