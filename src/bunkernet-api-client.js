import {API_SERVER} from "./explorer_constants";

const API_BASE = API_SERVER + "/"

export async function getBlock(hash) {
    const res = await fetch(`${API_BASE}blocks/${hash}?includeColor=true`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getTransaction(hash, blockHash) {
    const queryParams = blockHash ? `?blockHash=${blockHash}` : '';
    const res = await fetch(`${API_BASE}transactions/${hash}${queryParams}`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getBlockdagInfo() {
    const res = await fetch(`${API_BASE}info/blockdag`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getBunkerdInfo() {
    const res = await fetch(`${API_BASE}info/bunkerd`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getHashrate() {
    const res = await fetch(`${API_BASE}info/hashrate`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getHashrateMax() {
    const res = await fetch(`${API_BASE}info/hashrate/max`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getFeeEstimate() {
    const res = await fetch(`${API_BASE}info/fee-estimate`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getCoinSupply() {
    const res = await fetch(`${API_BASE}info/coinsupply`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getAddressBalance(addr) {
    const res = await fetch(`${API_BASE}addresses/${addr}/balance`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data.balance
        })
    return res
}


export async function getAddressTxCount(addr) {
    const res = await fetch(`${API_BASE}addresses/${addr}/transactions-count`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}


export async function getAddressUtxos(addr) {
    const res = await fetch(`${API_BASE}addresses/${addr}/utxos`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getAddressName(addr) {
    const res = await fetch(`${API_BASE}addresses/${addr}/name`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}


export async function getHalving() {
    const res = await fetch(`${API_BASE}info/halving`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

export async function getTransactionsFromAddress(addr, limit = 20, offset = 0) {
    const res = await fetch(`${API_BASE}addresses/${addr}/full-transactions?limit=${limit}&offset=${offset}`, {
        headers: {
            'Access-Control-Allow-Origin': '*', 'content-type': 'application/json'
        }, method: "GET"
    })
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}


export async function getTransactions(tx_list, inputs, outputs) {
    const res = await fetch(`${API_BASE}transactions/search`, {
        headers: {
            'Access-Control-Allow-Origin': '*', 'content-type': 'application/json'
        }, method: "POST", body: JSON.stringify({"transactionIds": tx_list})
    })
        .then((response) => response.json())
        .then(data => {
            return data
        })
    return res
}

// ─── Smart Contract API ──────────────────────────────────────

export async function getContracts(limit = 20, offset = 0) {
    const res = await fetch(`${API_BASE}contracts?limit=${limit}&offset=${offset}`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => data)
    return res
}

export async function getContractState(contractId) {
    const res = await fetch(`${API_BASE}contracts/${contractId}/state`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => data)
    return res
}

export async function getContractCode(contractId) {
    const res = await fetch(`${API_BASE}contracts/${contractId}/code`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => data)
    return res
}

export async function getContractInvocations(contractId, limit = 20, offset = 0) {
    const res = await fetch(`${API_BASE}contracts/${contractId}/invocations?limit=${limit}&offset=${offset}`, {headers: {'Access-Control-Allow-Origin': '*'}})
        .then((response) => response.json())
        .then(data => data)
    return res
}

export async function estimateContractGas(contractId, redeemerHex, gasLimit = 1000000) {
    const res = await fetch(`${API_BASE}contracts/${contractId}/estimate-gas`, {
        headers: {'Access-Control-Allow-Origin': '*', 'content-type': 'application/json'},
        method: "POST",
        body: JSON.stringify({ redeemer: redeemerHex, gasLimit })
    })
        .then((response) => response.json())
        .then(data => data)
    return res
}

