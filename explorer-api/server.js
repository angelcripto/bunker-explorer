const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const config = require('./config');
const { WrpcClient } = require('./wrpc-client');
const { migrate } = require('./db/migrate');
const { startIndexer } = require('./indexer/indexer');

// Routes
const createInfoRoutes = require('./routes/info');
const createBlocksRoutes = require('./routes/blocks');
const createTransactionsRoutes = require('./routes/transactions');
const createAddressesRoutes = require('./routes/addresses');
const createContractsRoutes = require('./routes/contracts');

async function main() {
    // ─── Express App ─────────────────────────────────────────────
    const app = express();
    app.use(cors({ origin: config.corsOrigins }));
    app.use(express.json());

    const server = http.createServer(app);

    // ─── Socket.io ───────────────────────────────────────────────
    const io = new SocketServer(server, {
        cors: { origin: config.corsOrigins },
        path: '/ws/socket.io'
    });

    // Track connected socket.io clients
    io.on('connection', (socket) => {
        console.log(`[Socket.io] Client connected: ${socket.id}`);

        socket.on('join-room', (room) => {
            socket.join(room);
        });

        socket.on('last-blocks', async () => {
            // Send last 20 blocks from DB
            try {
                const pool = require('./db/pool');
                const result = await pool.query(
                    `SELECT hash, blue_score AS "blueScore", timestamp, tx_count AS "txCount"
                     FROM blocks ORDER BY blue_score DESC LIMIT 20`
                );
                socket.emit('last-blocks', result.rows.reverse());
            } catch (err) {
                socket.emit('last-blocks', []);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket.io] Client disconnected: ${socket.id}`);
        });
    });

    // ─── wRPC Client ─────────────────────────────────────────────
    const wrpc = new WrpcClient(config.wrpcUrl);

    let nodeOnline = false;
    try {
        await wrpc.connect();
        nodeOnline = true;
        console.log('[Server] Connected to bunkerd wRPC');
    } catch (err) {
        console.warn(`[Server] Could not connect to bunkerd at ${config.wrpcUrl}: ${err.message}`);
        console.warn('[Server] Starting in offline mode - only DB-backed routes available');
    }

    wrpc.on('connect', () => { nodeOnline = true; });
    wrpc.on('disconnect', () => { nodeOnline = false; });

    // ─── Database Migration ──────────────────────────────────────
    try {
        await migrate();
        console.log('[Server] Database ready');
    } catch (err) {
        console.warn('[Server] Database migration failed:', err.message);
        console.warn('[Server] DB-backed routes will return errors until PostgreSQL is available');
    }

    // ─── Health endpoint ─────────────────────────────────────────
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', nodeOnline, timestamp: Date.now() });
    });

    // ─── API Routes ──────────────────────────────────────────────
    app.use('/info', createInfoRoutes(wrpc));
    app.use('/blocks', createBlocksRoutes(wrpc));
    app.use('/transactions', createTransactionsRoutes(wrpc));
    app.use('/addresses', createAddressesRoutes(wrpc));
    app.use('/contracts', createContractsRoutes(wrpc));

    // ─── Start Indexer ───────────────────────────────────────────
    if (nodeOnline) {
        startIndexer(wrpc, io).catch(err => {
            console.error('[Server] Indexer error:', err.message);
        });
    } else {
        // Retry when node comes online
        wrpc.on('connect', () => {
            startIndexer(wrpc, io).catch(err => {
                console.error('[Server] Indexer error:', err.message);
            });
        });
    }

    // ─── Start Server ────────────────────────────────────────────
    server.listen(config.port, () => {
        console.log(`[Server] BunkerNet Explorer API running on port ${config.port}`);
        console.log(`[Server] wRPC: ${config.wrpcUrl} (${nodeOnline ? 'connected' : 'offline'})`);
    });
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
