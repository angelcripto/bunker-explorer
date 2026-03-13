require('dotenv').config();

module.exports = {
    wrpcUrl: process.env.WRPC_URL || 'ws://127.0.0.1:28210',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://bunker_explorer:bunker_explorer@localhost:5432/bunker_explorer',
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigins: [
        'https://explorer.elbunkerbitcoin.com',
        'http://localhost:3000',
        'http://localhost:3001'
    ]
};
