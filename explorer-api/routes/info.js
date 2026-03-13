const { Router } = require('express');

function createInfoRoutes(wrpcClient) {
    const router = Router();

    // GET /info/blockdag
    router.get('/blockdag', async (req, res) => {
        try {
            const data = await wrpcClient.getBlockDagInfo();
            res.json(data);
        } catch (err) {
            res.status(503).json({ error: 'Node offline', detail: err.message });
        }
    });

    // GET /info/bunkerd (replaces /info/kaspad)
    router.get('/bunkerd', async (req, res) => {
        try {
            const [info, serverInfo] = await Promise.all([
                wrpcClient.getInfo(),
                wrpcClient.getServerInfo()
            ]);
            res.json({ ...info, ...serverInfo });
        } catch (err) {
            res.status(503).json({ error: 'Node offline', detail: err.message });
        }
    });

    // GET /info/hashrate
    router.get('/hashrate', async (req, res) => {
        try {
            const data = await wrpcClient.estimateNetworkHashesPerSecond();
            res.json(data);
        } catch (err) {
            res.status(503).json({ error: 'Node offline', detail: err.message });
        }
    });

    // GET /info/coinsupply
    router.get('/coinsupply', async (req, res) => {
        try {
            const data = await wrpcClient.getCoinSupply();
            res.json(data);
        } catch (err) {
            res.status(503).json({ error: 'Node offline', detail: err.message });
        }
    });

    // GET /info/fee-estimate
    router.get('/fee-estimate', async (req, res) => {
        try {
            const data = await wrpcClient.getFeeEstimate();
            res.json(data);
        } catch (err) {
            res.status(503).json({ error: 'Node offline', detail: err.message });
        }
    });

    // GET /info/market-data (stub - BNT has no CoinGecko listing)
    router.get('/market-data', async (req, res) => {
        res.json({
            current_price: { usd: 0 },
            price_change_percentage_1h_in_currency: { usd: 0 },
            price_change_percentage_24h: 0,
            price_change_percentage_7d: 0,
            total_volume: { usd: 0 },
            market_cap_rank: null
        });
    });

    // GET /info/blockreward (stub)
    router.get('/blockreward', async (req, res) => {
        res.json({ blockreward: 500 }); // Default block reward
    });

    // GET /info/halving (stub)
    router.get('/halving', async (req, res) => {
        res.json({
            nextHalvingTimestamp: 0,
            nextHalvingAmount: 0
        });
    });

    return router;
}

module.exports = createInfoRoutes;
