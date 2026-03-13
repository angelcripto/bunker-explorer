const { Router } = require('express');
const pool = require('../db/pool');

function createContractsRoutes(wrpcClient) {
    const router = Router();

    // GET /contracts?limit=20&offset=0
    router.get('/', async (req, res) => {
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const offset = parseInt(req.query.offset || '0', 10);

        try {
            const result = await pool.query(
                `SELECT contract_id AS "contractId",
                        deploy_tx_id AS "deployTxId",
                        block_hash AS "blockHash",
                        block_height AS "blockHeight",
                        code_hash AS "codeHash",
                        code_size AS "codeSize",
                        deployer_address AS "deployerAddress",
                        deployed_at AS "deployedAt"
                 FROM contract_deployments
                 ORDER BY deployed_at DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );

            const countResult = await pool.query(`SELECT COUNT(*) FROM contract_deployments`);

            res.json({
                contracts: result.rows,
                total: parseInt(countResult.rows[0].count, 10)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /contracts/:id/state (real-time from node)
    router.get('/:id/state', async (req, res) => {
        const { id } = req.params;

        try {
            const data = await wrpcClient.getContractState(id);
            res.json({
                contractId: data.contractId,
                datum: data.datum ? Buffer.from(data.datum).toString('hex') : null,
                codeHash: data.codeHash
            });
        } catch (err) {
            // If wRPC fails, try DB for deployment info
            try {
                const dbResult = await pool.query(
                    `SELECT contract_id AS "contractId",
                            code_hash AS "codeHash",
                            initial_datum AS "initialDatum"
                     FROM contract_deployments WHERE contract_id = $1`,
                    [id]
                );
                if (dbResult.rows.length > 0) {
                    const row = dbResult.rows[0];
                    return res.json({
                        contractId: row.contractId,
                        datum: row.initialDatum ? row.initialDatum.toString('hex') : null,
                        codeHash: row.codeHash,
                        _source: 'indexed'
                    });
                }
            } catch (dbErr) {
                // ignore
            }
            res.status(404).json({ error: 'Contract not found', detail: err.message });
        }
    });

    // GET /contracts/:id/code (from node)
    router.get('/:id/code', async (req, res) => {
        const { id } = req.params;

        try {
            const data = await wrpcClient.getContractCode(id);
            res.json({
                contractId: id,
                code: data.code ? Buffer.from(data.code).toString('base64') : null,
                codeSize: data.code ? data.code.length : 0
            });
        } catch (err) {
            res.status(404).json({ error: 'Contract not found', detail: err.message });
        }
    });

    // POST /contracts/:id/estimate-gas
    router.post('/:id/estimate-gas', async (req, res) => {
        const { id } = req.params;
        const { redeemer, gasLimit } = req.body;

        if (!redeemer) {
            return res.status(400).json({ error: 'redeemer (hex string) required' });
        }

        try {
            const redeemerBytes = Array.from(Buffer.from(redeemer, 'hex'));
            const data = await wrpcClient.estimateContractGas(id, redeemerBytes, gasLimit || 1000000);
            res.json({
                gasUsed: data.gasUsed,
                wouldAccept: data.wouldAccept
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /contracts/:id/invocations?limit=20&offset=0
    router.get('/:id/invocations', async (req, res) => {
        const { id } = req.params;
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const offset = parseInt(req.query.offset || '0', 10);

        try {
            const result = await pool.query(
                `SELECT invoke_tx_id AS "invokeTxId",
                        block_hash AS "blockHash",
                        block_height AS "blockHeight",
                        invoker_address AS "invokerAddress",
                        invoked_at AS "invokedAt"
                 FROM contract_invocations
                 WHERE contract_id = $1
                 ORDER BY invoked_at DESC
                 LIMIT $2 OFFSET $3`,
                [id, limit, offset]
            );

            const countResult = await pool.query(
                `SELECT COUNT(*) FROM contract_invocations WHERE contract_id = $1`, [id]
            );

            res.json({
                invocations: result.rows,
                total: parseInt(countResult.rows[0].count, 10)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = createContractsRoutes;
