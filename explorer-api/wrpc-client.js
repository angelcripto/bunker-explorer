const WebSocket = require('ws');
const EventEmitter = require('events');

// RpcApiOps enum values from rpc/core/src/api/ops.rs
// serde(rename_all = "camelCase") — server expects camelCase strings, not numbers
const RpcApiOps = {
    // Control
    Subscribe: 'subscribe',
    Unsubscribe: 'unsubscribe',

    // Subscriptions
    NotifyBlockAdded: 'notifyBlockAdded',
    NotifyNewBlockTemplate: 'notifyNewBlockTemplate',
    NotifyUtxosChanged: 'notifyUtxosChanged',
    NotifyPruningPointUtxoSetOverride: 'notifyPruningPointUtxoSetOverride',
    NotifyFinalityConflict: 'notifyFinalityConflict',
    NotifyVirtualDaaScoreChanged: 'notifyVirtualDaaScoreChanged',
    NotifyVirtualChainChanged: 'notifyVirtualChainChanged',
    NotifySinkBlueScoreChanged: 'notifySinkBlueScoreChanged',

    // Notifications (server -> client)
    BlockAddedNotification: 'blockAddedNotification',
    VirtualChainChangedNotification: 'virtualChainChangedNotification',
    FinalityConflictNotification: 'finalityConflictNotification',
    FinalityConflictResolvedNotification: 'finalityConflictResolvedNotification',
    UtxosChangedNotification: 'utxosChangedNotification',
    SinkBlueScoreChangedNotification: 'sinkBlueScoreChangedNotification',
    VirtualDaaScoreChangedNotification: 'virtualDaaScoreChangedNotification',
    PruningPointUtxoSetOverrideNotification: 'pruningPointUtxoSetOverrideNotification',
    NewBlockTemplateNotification: 'newBlockTemplateNotification',

    // RPC Methods
    Ping: 'ping',
    GetMetrics: 'getMetrics',
    GetSystemInfo: 'getSystemInfo',
    GetConnections: 'getConnections',
    GetServerInfo: 'getServerInfo',
    GetSyncStatus: 'getSyncStatus',
    GetCurrentNetwork: 'getCurrentNetwork',
    SubmitBlock: 'submitBlock',
    GetBlockTemplate: 'getBlockTemplate',
    GetPeerAddresses: 'getPeerAddresses',
    GetSink: 'getSink',
    GetMempoolEntry: 'getMempoolEntry',
    GetMempoolEntries: 'getMempoolEntries',
    GetConnectedPeerInfo: 'getConnectedPeerInfo',
    AddPeer: 'addPeer',
    SubmitTransaction: 'submitTransaction',
    GetBlock: 'getBlock',
    GetSubnetwork: 'getSubnetwork',
    GetVirtualChainFromBlock: 'getVirtualChainFromBlock',
    GetBlocks: 'getBlocks',
    GetBlockCount: 'getBlockCount',
    GetBlockDagInfo: 'getBlockDagInfo',
    ResolveFinalityConflict: 'resolveFinalityConflict',
    Shutdown: 'shutdown',
    GetHeaders: 'getHeaders',
    GetUtxosByAddresses: 'getUtxosByAddresses',
    GetBalanceByAddress: 'getBalanceByAddress',
    GetBalancesByAddresses: 'getBalancesByAddresses',
    GetSinkBlueScore: 'getSinkBlueScore',
    Ban: 'ban',
    Unban: 'unban',
    GetInfo: 'getInfo',
    EstimateNetworkHashesPerSecond: 'estimateNetworkHashesPerSecond',
    GetMempoolEntriesByAddresses: 'getMempoolEntriesByAddresses',
    GetCoinSupply: 'getCoinSupply',
    GetDaaScoreTimestampEstimate: 'getDaaScoreTimestampEstimate',
    SubmitTransactionReplacement: 'submitTransactionReplacement',
    GetFeeEstimate: 'getFeeEstimate',
    GetFeeEstimateExperimental: 'getFeeEstimateExperimental',
    GetCurrentBlockColor: 'getCurrentBlockColor',
    GetUtxoReturnAddress: 'getUtxoReturnAddress',
    GetVirtualChainFromBlockV2: 'getVirtualChainFromBlockV2',

    // Smart Contracts
    GetContractState: 'getContractState',
    GetContractCode: 'getContractCode',
    EstimateContractGas: 'estimateContractGas',
};

// Map notifyOp strings to Scope enum variants (PascalCase, as expected by serde)
const NotifyOpToScopeName = {
    [RpcApiOps.NotifyBlockAdded]: 'BlockAdded',
    [RpcApiOps.NotifyNewBlockTemplate]: 'NewBlockTemplate',
    [RpcApiOps.NotifyUtxosChanged]: 'UtxosChanged',
    [RpcApiOps.NotifyPruningPointUtxoSetOverride]: 'PruningPointUtxoSetOverride',
    [RpcApiOps.NotifyFinalityConflict]: 'FinalityConflict',
    [RpcApiOps.NotifyVirtualDaaScoreChanged]: 'VirtualDaaScoreChanged',
    [RpcApiOps.NotifyVirtualChainChanged]: 'VirtualChainChanged',
    [RpcApiOps.NotifySinkBlueScoreChanged]: 'SinkBlueScoreChanged',
};

function _notifyOpToScope(notifyOp, params = {}) {
    const scopeName = NotifyOpToScopeName[notifyOp];
    if (!scopeName) throw new Error(`Unknown notify op: ${notifyOp}`);
    // Scope is a serde enum: { "VariantName": { ...inner_scope } }
    return { [scopeName]: params };
}

class WrpcClient extends EventEmitter {
    constructor(url) {
        super();
        this.url = url;
        this.ws = null;
        this.messageId = 0;
        this.pending = new Map(); // id -> { resolve, reject, timeout }
        this.connected = false;
        this.reconnectTimer = null;
        this.REQUEST_TIMEOUT = 15000;
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.connected) {
                return resolve();
            }

            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                this.connected = true;
                console.log(`[wRPC] Connected to ${this.url}`);
                this.emit('connect');
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this._handleMessage(msg);
                } catch (err) {
                    console.error('[wRPC] Failed to parse message:', err);
                }
            });

            this.ws.on('close', () => {
                this.connected = false;
                console.log('[wRPC] Disconnected');
                this._rejectAllPending('Connection closed');
                this.emit('disconnect');
                this._scheduleReconnect();
            });

            this.ws.on('error', (err) => {
                console.error('[wRPC] Error:', err.message);
                if (!this.connected) {
                    reject(err);
                }
            });
        });
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            console.log('[wRPC] Reconnecting...');
            this.connect().catch(() => {});
        }, 3000);
    }

    _handleMessage(msg) {
        const { id, method: op, params: data, error } = msg;

        // If it has an id, it's a response to a pending request
        if (id !== undefined && this.pending.has(id)) {
            const { resolve, reject, timeout } = this.pending.get(id);
            clearTimeout(timeout);
            this.pending.delete(id);

            if (error) {
                reject(new Error(error.message || JSON.stringify(error)));
            } else {
                resolve(data);
            }
            return;
        }

        // Notification (no id, has a notification method string)
        if (op && typeof op === 'string' && op.endsWith('Notification')) {
            this.emit('notification', { op, data });

            // Emit specific notification events
            switch (op) {
                case RpcApiOps.BlockAddedNotification:
                    this.emit('block-added', data);
                    break;
                case RpcApiOps.VirtualChainChangedNotification:
                    this.emit('virtual-chain-changed', data);
                    break;
                case RpcApiOps.VirtualDaaScoreChangedNotification:
                    this.emit('virtual-daa-score-changed', data);
                    break;
                case RpcApiOps.SinkBlueScoreChangedNotification:
                    this.emit('sink-blue-score-changed', data);
                    break;
                case RpcApiOps.UtxosChangedNotification:
                    this.emit('utxos-changed', data);
                    break;
                case RpcApiOps.NewBlockTemplateNotification:
                    this.emit('new-block-template', data);
                    break;
            }
        }
    }

    _rejectAllPending(reason) {
        for (const [id, { reject, timeout }] of this.pending) {
            clearTimeout(timeout);
            reject(new Error(reason));
        }
        this.pending.clear();
    }

    /**
     * Send an RPC request and wait for the response.
     * @param {number} op - Operation ID from RpcApiOps
     * @param {object} data - Request payload
     * @returns {Promise<object>} Response data
     */
    async request(op, data = {}) {
        if (!this.connected) {
            throw new Error('Not connected to bunkerd wRPC');
        }

        const id = ++this.messageId;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Request timeout (op=${op}, id=${id})`));
            }, this.REQUEST_TIMEOUT);

            this.pending.set(id, { resolve, reject, timeout });

            const msg = JSON.stringify({ id, method: op, params: data });
            this.ws.send(msg);
        });
    }

    /**
     * Subscribe to a notification scope via the "subscribe" RPC method.
     * The server expects a Scope enum variant as params, e.g. {"BlockAdded": {}}
     */
    async subscribe(notifyOp, params = {}) {
        const scope = _notifyOpToScope(notifyOp, params);
        return this.request(RpcApiOps.Subscribe, scope);
    }

    /**
     * Unsubscribe from a notification scope via the "unsubscribe" RPC method.
     */
    async unsubscribe(notifyOp, params = {}) {
        const scope = _notifyOpToScope(notifyOp, params);
        return this.request(RpcApiOps.Unsubscribe, scope);
    }

    close() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }

    // ─── Convenience Methods ─────────────────────────────────────────

    async ping() {
        return this.request(RpcApiOps.Ping);
    }

    async getInfo() {
        return this.request(RpcApiOps.GetInfo);
    }

    async getServerInfo() {
        return this.request(RpcApiOps.GetServerInfo);
    }

    async getSyncStatus() {
        return this.request(RpcApiOps.GetSyncStatus);
    }

    async getCurrentNetwork() {
        return this.request(RpcApiOps.GetCurrentNetwork);
    }

    async getBlockDagInfo() {
        return this.request(RpcApiOps.GetBlockDagInfo);
    }

    async getBlock(hash, includeTransactions = true) {
        return this.request(RpcApiOps.GetBlock, { hash, includeTransactions });
    }

    async getBlocks(lowHash, includeBlocks = true, includeTransactions = true) {
        return this.request(RpcApiOps.GetBlocks, { lowHash, includeBlocks, includeTransactions });
    }

    async getBlockCount() {
        return this.request(RpcApiOps.GetBlockCount);
    }

    async getUtxosByAddresses(addresses) {
        return this.request(RpcApiOps.GetUtxosByAddresses, { addresses });
    }

    async getBalanceByAddress(address) {
        return this.request(RpcApiOps.GetBalanceByAddress, { address });
    }

    async getBalancesByAddresses(addresses) {
        return this.request(RpcApiOps.GetBalancesByAddresses, { addresses });
    }

    async getSinkBlueScore() {
        return this.request(RpcApiOps.GetSinkBlueScore);
    }

    async estimateNetworkHashesPerSecond(windowSize = 2048, startHash = undefined) {
        const params = { windowSize };
        if (startHash) params.startHash = startHash;
        return this.request(RpcApiOps.EstimateNetworkHashesPerSecond, params);
    }

    async getCoinSupply() {
        return this.request(RpcApiOps.GetCoinSupply);
    }

    async getFeeEstimate() {
        return this.request(RpcApiOps.GetFeeEstimate);
    }

    async getMempoolEntries(includeOrphanPool = false, filterTransactionPool = false) {
        return this.request(RpcApiOps.GetMempoolEntries, { includeOrphanPool, filterTransactionPool });
    }

    async getMempoolEntry(txId) {
        return this.request(RpcApiOps.GetMempoolEntry, { txId, includeOrphanPool: false, filterTransactionPool: false });
    }

    async getSink() {
        return this.request(RpcApiOps.GetSink);
    }

    async getVirtualChainFromBlock(startHash, includeAcceptedTransactionIds = true) {
        return this.request(RpcApiOps.GetVirtualChainFromBlock, { startHash, includeAcceptedTransactionIds });
    }

    // ─── Smart Contract Methods ──────────────────────────────────────

    async getContractState(contractId) {
        return this.request(RpcApiOps.GetContractState, { contractId });
    }

    async getContractCode(contractId) {
        return this.request(RpcApiOps.GetContractCode, { contractId });
    }

    async estimateContractGas(contractId, redeemer, gasLimit) {
        return this.request(RpcApiOps.EstimateContractGas, { contractId, redeemer, gasLimit });
    }

    // ─── Subscription Helpers ────────────────────────────────────────

    async subscribeBlockAdded() {
        return this.subscribe(RpcApiOps.NotifyBlockAdded);
    }

    async subscribeVirtualChainChanged(includeAcceptedTransactionIds = true) {
        return this.subscribe(RpcApiOps.NotifyVirtualChainChanged, { includeAcceptedTransactionIds });
    }

    async subscribeVirtualDaaScoreChanged() {
        return this.subscribe(RpcApiOps.NotifyVirtualDaaScoreChanged);
    }

    async subscribeSinkBlueScoreChanged() {
        return this.subscribe(RpcApiOps.NotifySinkBlueScoreChanged);
    }

    async subscribeUtxosChanged(addresses) {
        return this.subscribe(RpcApiOps.NotifyUtxosChanged, { addresses });
    }
}

module.exports = { WrpcClient, RpcApiOps };
