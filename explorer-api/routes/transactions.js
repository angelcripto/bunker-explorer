const { Router } = require('express');
const pool = require('../db/pool');

function createTransactionsRoutes(wrpcClient) {
    const router = Router();

    // GET /transactions/:txid
    router.get('/:txid', async (req, res) => {
        const { txid } = req.params;

        // Try DB
        try {
            const txResult = await pool.query(
                `SELECT raw_json FROM transactions WHERE tx_id = $1`, [txid]
            );
            if (txResult.rows.length > 0 && txResult.rows[0].raw_json) {
                const tx = txResult.rows[0].raw_json;

                // Enrich with inputs/outputs from DB
                const inputs = await pool.query(
                    `SELECT * FROM transaction_inputs WHERE tx_id = $1 ORDER BY idx`, [txid]
                );
                const outputs = await pool.query(
                    `SELECT * FROM transaction_outputs WHERE tx_id = $1 ORDER BY idx`, [txid]
                );

                return res.json({
                    ...tx,
                    _indexed: true,
                    _inputs: inputs.rows,
                    _outputs: outputs.rows
                });
            }
        } catch (err) {
            // Fall through
        }

        // Cannot look up individual tx by ID via wRPC without knowing the block
        res.status(404).json({ detail: 'Transaction not found' });
    });

    // POST /transactions/search
    router.post('/search', async (req, res) => {
        const { transactionIds } = req.body;
        if (!transactionIds || !Array.isArray(transactionIds)) {
            return res.status(400).json({ error: 'transactionIds array required' });
        }

        try {
            const placeholders = transactionIds.map((_, i) => `$${i + 1}`).join(',');
            const result = await pool.query(
                `SELECT raw_json FROM transactions WHERE tx_id IN (${placeholders})`,
                transactionIds
            );
            res.json(result.rows.map(r => r.raw_json));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = createTransactionsRoutes;
