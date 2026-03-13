let SOCKET_SERVER = process.env.WS_SERVER || "wss://explorer.elbunkerbitcoin.com/ws";
let SUFFIX = ""
let API_SERVER = process.env.REACT_APP_API_SERVER || ""
let ADDRESS_PREFIX = "bnet:"
let BNT_UNIT = "BNT"

let BPS = 1


switch (process.env.REACT_APP_NETWORK) {
    case "testnet":
        ADDRESS_PREFIX = "bnettest:"
        if (!API_SERVER) {
            API_SERVER = "https://explorer.elbunkerbitcoin.com/api"
        }
        SUFFIX = " TESTNET"
        BNT_UNIT = "TBNT"
        break;

    // mainnet
    default:
        if (!API_SERVER) {
            API_SERVER = process.env.REACT_APP_API_URL || "https://explorer.elbunkerbitcoin.com/api"
        }
        break;
}

export { SOCKET_SERVER, SUFFIX, API_SERVER, ADDRESS_PREFIX, BPS, BNT_UNIT }
