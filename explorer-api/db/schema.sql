-- BunkerNet Explorer Database Schema

-- Bloques
CREATE TABLE IF NOT EXISTS blocks (
    hash            VARCHAR(64) PRIMARY KEY,
    blue_score      BIGINT NOT NULL,
    timestamp       BIGINT NOT NULL,
    daa_score       BIGINT NOT NULL,
    block_height    BIGINT NOT NULL,
    parent_hashes   TEXT[],
    is_chain_block  BOOLEAN DEFAULT FALSE,
    difficulty      DOUBLE PRECISION,
    merge_set_size  INTEGER,
    tx_count        INTEGER NOT NULL DEFAULT 0,
    raw_json        JSONB,
    indexed_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blocks_blue_score ON blocks(blue_score DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_block_height ON blocks(block_height DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_daa_score ON blocks(daa_score DESC);

-- Transacciones
CREATE TABLE IF NOT EXISTS transactions (
    tx_id           VARCHAR(64) PRIMARY KEY,
    block_hash      VARCHAR(64) NOT NULL REFERENCES blocks(hash) ON DELETE CASCADE,
    subnetwork_id   VARCHAR(64) NOT NULL,
    mass            BIGINT,
    block_time      BIGINT NOT NULL,
    is_accepted     BOOLEAN DEFAULT TRUE,
    payload         BYTEA,
    raw_json        JSONB,
    indexed_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tx_block_hash ON transactions(block_hash);
CREATE INDEX IF NOT EXISTS idx_tx_subnetwork ON transactions(subnetwork_id);
CREATE INDEX IF NOT EXISTS idx_tx_block_time ON transactions(block_time DESC);

-- Inputs de transaccion
CREATE TABLE IF NOT EXISTS transaction_inputs (
    id              BIGSERIAL PRIMARY KEY,
    tx_id           VARCHAR(64) NOT NULL REFERENCES transactions(tx_id) ON DELETE CASCADE,
    idx             INTEGER NOT NULL,
    previous_tx_id  VARCHAR(64),
    previous_index  INTEGER,
    address         VARCHAR(128),
    amount          BIGINT
);
CREATE INDEX IF NOT EXISTS idx_txin_tx_id ON transaction_inputs(tx_id);
CREATE INDEX IF NOT EXISTS idx_txin_address ON transaction_inputs(address);

-- Outputs de transaccion
CREATE TABLE IF NOT EXISTS transaction_outputs (
    id              BIGSERIAL PRIMARY KEY,
    tx_id           VARCHAR(64) NOT NULL REFERENCES transactions(tx_id) ON DELETE CASCADE,
    idx             INTEGER NOT NULL,
    address         VARCHAR(128),
    amount          BIGINT NOT NULL,
    script_pub_key  TEXT,
    is_spent        BOOLEAN DEFAULT FALSE,
    spending_tx_id  VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_txout_tx_id ON transaction_outputs(tx_id);
CREATE INDEX IF NOT EXISTS idx_txout_address ON transaction_outputs(address);
CREATE INDEX IF NOT EXISTS idx_txout_unspent ON transaction_outputs(address, is_spent) WHERE NOT is_spent;

-- Direcciones (balance cacheado)
CREATE TABLE IF NOT EXISTS addresses (
    address         VARCHAR(128) PRIMARY KEY,
    balance         BIGINT NOT NULL DEFAULT 0,
    tx_count        INTEGER NOT NULL DEFAULT 0,
    first_seen      BIGINT,
    last_seen       BIGINT,
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addresses_balance ON addresses(balance DESC);

-- Despliegues de contratos
CREATE TABLE IF NOT EXISTS contract_deployments (
    contract_id     VARCHAR(64) PRIMARY KEY,
    deploy_tx_id    VARCHAR(64) NOT NULL REFERENCES transactions(tx_id) ON DELETE CASCADE,
    block_hash      VARCHAR(64) NOT NULL REFERENCES blocks(hash) ON DELETE CASCADE,
    block_height    BIGINT NOT NULL,
    code_hash       VARCHAR(64),
    code_size       INTEGER,
    initial_datum   BYTEA,
    deployer_address VARCHAR(128),
    deployed_at     BIGINT NOT NULL,
    indexed_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cd_block_height ON contract_deployments(block_height DESC);
CREATE INDEX IF NOT EXISTS idx_cd_deployer ON contract_deployments(deployer_address);
CREATE INDEX IF NOT EXISTS idx_cd_deployed_at ON contract_deployments(deployed_at DESC);

-- Invocaciones de contratos
CREATE TABLE IF NOT EXISTS contract_invocations (
    id              BIGSERIAL PRIMARY KEY,
    contract_id     VARCHAR(64) NOT NULL REFERENCES contract_deployments(contract_id) ON DELETE CASCADE,
    invoke_tx_id    VARCHAR(64) NOT NULL REFERENCES transactions(tx_id) ON DELETE CASCADE,
    block_hash      VARCHAR(64) NOT NULL REFERENCES blocks(hash) ON DELETE CASCADE,
    block_height    BIGINT NOT NULL,
    redeemer        BYTEA,
    new_datum       BYTEA,
    invoker_address VARCHAR(128),
    invoked_at      BIGINT NOT NULL,
    indexed_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ci_contract_id ON contract_invocations(contract_id);
CREATE INDEX IF NOT EXISTS idx_ci_block_height ON contract_invocations(block_height DESC);
CREATE INDEX IF NOT EXISTS idx_ci_invoker ON contract_invocations(invoker_address);
CREATE INDEX IF NOT EXISTS idx_ci_invoked_at ON contract_invocations(invoked_at DESC);

-- Estado del indexador
CREATE TABLE IF NOT EXISTS indexer_state (
    key             VARCHAR(64) PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TIMESTAMP DEFAULT NOW()
);
