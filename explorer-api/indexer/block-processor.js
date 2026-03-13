const pool = require('../db/pool');

// SubnetworkId for contract transactions (0x03 padded to 40 hex chars)
const CONTRACT_SUBNETWORK = '0300000000000000000000000000000000000000';

/**
 * Parse a borsh-encoded ContractPayload from a hex string.
 * ContractPayload enum:
 *   Variant 0 = Deploy { code: Vec<u8>, initial_datum: Vec<u8> }
 *   Variant 1 = Invoke { contract_id: [u8;32], redeemer: Vec<u8>, new_datum: Vec<u8> }
 */
function parseContractPayload(payloadHex) {
    if (!payloadHex) return null;

    try {
        const buf = Buffer.from(payloadHex, 'hex');
        let offset = 0;

        const variant = buf.readUInt8(offset);
        offset += 1;

        if (variant === 0) {
            // Deploy
            const codeLen = buf.readUInt32LE(offset);
            offset += 4;
            const code = buf.slice(offset, offset + codeLen);
            offset += codeLen;

            const datumLen = buf.readUInt32LE(offset);
            offset += 4;
            const initialDatum = buf.slice(offset, offset + datumLen);

            return { type: 'deploy', code, initialDatum };
        } else if (variant === 1) {
            // Invoke
            const contractId = buf.slice(offset, offset + 32).toString('hex');
            offset += 32;

            const redeemerLen = buf.readUInt32LE(offset);
            offset += 4;
            const redeemer = buf.slice(offset, offset + redeemerLen);
            offset += redeemerLen;

            const newDatumLen = buf.readUInt32LE(offset);
            offset += 4;
            const newDatum = buf.slice(offset, offset + newDatumLen);

            return { type: 'invoke', contractId, redeemer, newDatum };
        }
    } catch (err) {
        console.error('[Indexer] Failed to parse contract payload:', err.message);
    }
    return null;
}

/**
 * Process a single block from the wRPC response and store it in PostgreSQL.
 */
async function processBlock(blockData, client) {
    const db = client || pool;
    const header = blockData.header;
    const txs = blockData.transactions || [];
    const blockHash = blockData.verboseData?.hash || header.hashMerkleRoot;
    const blueScore = parseInt(blockData.verboseData?.blueScore || '0', 10);
    const daaScore = parseInt(blockData.verboseData?.daaScore || '0', 10);
    const timestamp = parseInt(header.timestamp || '0', 10);
    const parentHashes = header.parents?.map(p => p.parentHashes).flat() || [];
    const difficulty = parseFloat(blockData.verboseData?.difficulty || '0');
    const isChainBlock = blockData.verboseData?.isChainBlock || false;
    const mergeSetSize = parseInt(blockData.verboseData?.mergeSetBluesMerkleRoot ? '0' : '0', 10);

    // Insert block
    await db.query(
        `INSERT INTO blocks (hash, blue_score, timestamp, daa_score, block_height, parent_hashes, is_chain_block, difficulty, tx_count, raw_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (hash) DO NOTHING`,
        [blockHash, blueScore, timestamp, daaScore, blueScore, parentHashes, isChainBlock, difficulty, txs.length, JSON.stringify(blockData)]
    );

    // Process transactions
    for (const tx of txs) {
        const txId = tx.verboseData?.transactionId || tx.id;
        if (!txId) continue;

        const subnetworkId = tx.subnetworkId || '';
        const mass = parseInt(tx.verboseData?.mass || '0', 10);
        const blockTime = parseInt(tx.verboseData?.blockTime || timestamp.toString(), 10);
        const payload = tx.payload || null;

        await db.query(
            `INSERT INTO transactions (tx_id, block_hash, subnetwork_id, mass, block_time, payload, raw_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (tx_id) DO NOTHING`,
            [txId, blockHash, subnetworkId, mass, blockTime, payload ? Buffer.from(payload, 'hex') : null, JSON.stringify(tx)]
        );

        // Process inputs
        const inputs = tx.inputs || [];
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const prevTxId = input.previousOutpoint?.transactionId || null;
            const prevIndex = input.previousOutpoint?.index ?? null;
            // Address from UTXO index (if available in verbose data)
            const addr = input.verboseData?.address || null;
            const amount = parseInt(input.verboseData?.amount || '0', 10) || null;

            await db.query(
                `INSERT INTO transaction_inputs (tx_id, idx, previous_tx_id, previous_index, address, amount)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [txId, i, prevTxId, prevIndex, addr, amount]
            );

            // Mark the spent output
            if (prevTxId && prevIndex !== null) {
                await db.query(
                    `UPDATE transaction_outputs SET is_spent = TRUE, spending_tx_id = $1
                     WHERE tx_id = $2 AND idx = $3 AND NOT is_spent`,
                    [txId, prevTxId, prevIndex]
                );
            }

            // Update address stats
            if (addr) {
                await upsertAddress(db, addr, blockTime);
            }
        }

        // Process outputs
        const outputs = tx.outputs || [];
        for (let i = 0; i < outputs.length; i++) {
            const output = outputs[i];
            const addr = output.verboseData?.scriptPublicKeyAddress || null;
            const amount = parseInt(output.amount || '0', 10);
            const scriptPubKey = output.scriptPublicKey?.script || null;

            await db.query(
                `INSERT INTO transaction_outputs (tx_id, idx, address, amount, script_pub_key)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT DO NOTHING`,
                [txId, i, addr, amount, scriptPubKey]
            );

            if (addr) {
                await upsertAddress(db, addr, blockTime);
            }
        }

        // Process contract transactions
        if (subnetworkId === CONTRACT_SUBNETWORK && payload) {
            const parsed = parseContractPayload(payload);
            if (parsed) {
                if (parsed.type === 'deploy') {
                    // contract_id = tx_hash for deploys
                    const crypto = require('crypto');
                    const codeHash = crypto.createHash('sha256').update(parsed.code).digest('hex');
                    const deployerAddr = inputs[0]?.verboseData?.address || null;

                    await db.query(
                        `INSERT INTO contract_deployments (contract_id, deploy_tx_id, block_hash, block_height, code_hash, code_size, initial_datum, deployer_address, deployed_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         ON CONFLICT (contract_id) DO NOTHING`,
                        [txId, txId, blockHash, blueScore, codeHash, parsed.code.length, parsed.initialDatum, deployerAddr, blockTime]
                    );
                    console.log(`[Indexer] Contract deployed: ${txId.substring(0, 16)}...`);
                } else if (parsed.type === 'invoke') {
                    const invokerAddr = inputs[0]?.verboseData?.address || null;

                    await db.query(
                        `INSERT INTO contract_invocations (contract_id, invoke_tx_id, block_hash, block_height, redeemer, new_datum, invoker_address, invoked_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                         ON CONFLICT DO NOTHING`,
                        [parsed.contractId, txId, blockHash, blueScore, parsed.redeemer, parsed.newDatum, invokerAddr, blockTime]
                    );
                }
            }
        }
    }

    return { blockHash, blueScore, txCount: txs.length };
}

async function upsertAddress(db, address, blockTime) {
    await db.query(
        `INSERT INTO addresses (address, balance, tx_count, first_seen, last_seen)
         VALUES ($1, 0, 1, $2, $2)
         ON CONFLICT (address) DO UPDATE SET
           tx_count = addresses.tx_count + 1,
           last_seen = GREATEST(addresses.last_seen, $2),
           updated_at = NOW()`,
        [address, blockTime]
    );
}

/**
 * Recalculate balance for a specific address from UTXOs.
 */
async function recalculateBalance(db, address) {
    const result = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as balance
         FROM transaction_outputs
         WHERE address = $1 AND NOT is_spent`,
        [address]
    );
    const balance = parseInt(result.rows[0].balance, 10);
    await db.query(
        `UPDATE addresses SET balance = $1, updated_at = NOW() WHERE address = $2`,
        [balance, address]
    );
    return balance;
}

module.exports = { processBlock, parseContractPayload, recalculateBalance, CONTRACT_SUBNETWORK };
