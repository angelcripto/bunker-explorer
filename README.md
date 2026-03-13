# BunkerNet Explorer

A blockchain explorer for **BunkerNet** — a DAG-based blockchain with smart contracts using the eUTXO model and WASM execution.

## Stack

- **Frontend**: React 18 (forked from kaspa-explorer)
- **Backend API**: Express.js REST API
- **Database**: PostgreSQL (full block/tx/contract indexer)
- **Node Connection**: wRPC JSON over WebSocket (bunkerd port 18110)
- **Realtime**: Socket.io for live block updates

## Architecture

```
[React SPA]  -->  [Express API]  -->  [PostgreSQL]  <--  [Indexer]  -->  [bunkerd wRPC JSON]
 port 3000        port 3001           port 5432          (process)        port 18110
```

## Features

- Block explorer with DAG visualization
- Transaction details with inputs/outputs
- Address balance and transaction history
- **Smart Contract Explorer** — list deployed contracts, view state/datum, code hash, invocation history
- Real-time block updates via WebSocket
- Coin supply and network stats

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- bunkerd running (mainnet or devnet)

### Setup

```bash
# Frontend dependencies
npm install

# API dependencies
cd explorer-api
npm install

# Create database
createdb bunker_explorer
psql -d bunker_explorer -f db/schema.sql

# Configure
# Edit explorer-api/.env with your WRPC_URL and DATABASE_URL
```

### Run in development

```bash
# Terminal 1: API + Indexer
cd explorer-api
node server.js

# Terminal 2: Frontend
npm start
```

### Build for production

```bash
npm run build
```

## Environment Variables

### Frontend (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_SERVER` | `https://explorer.elbunkerbitcoin.com/api` | API base URL |
| `WS_SERVER` | `wss://explorer.elbunkerbitcoin.com/ws` | WebSocket URL |
| `REACT_APP_NETWORK` | (mainnet) | `testnet` for testnet mode |

### API (explorer-api/.env)
| Variable | Default | Description |
|----------|---------|-------------|
| `WRPC_URL` | `ws://127.0.0.1:18110` | bunkerd wRPC JSON endpoint |
| `DATABASE_URL` | `postgresql://...@localhost:5432/bunker_explorer` | PostgreSQL connection |
| `PORT` | `3001` | API server port |

## Deploy to VPS

```bash
# On VPS (Ubuntu)
sudo bash deploy/setup.sh
```

This will:
1. Install Node.js, PostgreSQL, PM2
2. Create database and run migrations
3. Copy frontend build to nginx root
4. Start API with PM2
5. Configure nginx reverse proxy
6. Setup SSL with Certbot

## Network Details

- **Ticker**: BNT
- **Address prefix**: `bnet:` (mainnet) / `bnettest:` (testnet)
- **Unit**: SOMPI (100,000,000 SOMPI = 1 BNT)
- **gRPC port**: 16110
- **wRPC JSON port**: 18110

## License

ISC
