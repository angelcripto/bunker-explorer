import {useEffect, useState} from "react";
import {Col, Container, Row, Spinner, Table, Badge} from "react-bootstrap";
import {Link, useParams} from "react-router-dom";
import {getContractState, getContractCode, getContractInvocations} from "../bunkernet-api-client";

const ContractDetail = () => {
    const {id} = useParams();
    const [state, setState] = useState(null);
    const [code, setCode] = useState(null);
    const [invocations, setInvocations] = useState([]);
    const [invTotal, setInvTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCode, setShowCode] = useState(false);

    useEffect(() => {
        loadContract();
    }, [id]);

    const loadContract = async () => {
        setLoading(true);
        setError(null);

        try {
            const [stateData, invData] = await Promise.all([
                getContractState(id).catch(() => null),
                getContractInvocations(id).catch(() => ({invocations: [], total: 0}))
            ]);

            if (stateData && !stateData.error) {
                setState(stateData);
            } else {
                setError('Contract not found or node offline');
            }

            setInvocations(invData.invocations || []);
            setInvTotal(invData.total || 0);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    const loadCode = async () => {
        if (code) {
            setShowCode(!showCode);
            return;
        }
        try {
            const data = await getContractCode(id);
            setCode(data);
            setShowCode(true);
        } catch (err) {
            console.error("Failed to load code:", err);
        }
    };

    if (loading) {
        return (
            <Container className="webpage mt-4 text-center py-5">
                <Spinner animation="border" variant="primary"/>
            </Container>
        );
    }

    if (error && !state) {
        return (
            <Container className="webpage mt-4">
                <div className="text-light text-center py-5">
                    <h4>Contract Not Found</h4>
                    <p className="text-muted">{error}</p>
                    <p className="text-muted" style={{fontFamily: "monospace", fontSize: "small", wordBreak: "break-all"}}>
                        {id}
                    </p>
                </div>
            </Container>
        );
    }

    return (
        <Container className="webpage mt-4" fluid>
            <Row>
                <Col>
                    <h3 className="text-light mb-3">
                        <i className="fa fa-file-code-o me-2"/>Contract Detail
                        {state?._source === 'indexed' &&
                            <Badge bg="warning" className="ms-2" style={{fontSize: "x-small"}}>Indexed</Badge>}
                    </h3>

                    <div className="blockinfo-content text-light">
                        <table className="w-100">
                            <tbody>
                            <tr className="blockinfo-row">
                                <td className="px-3 py-2" style={{width: "180px", color: "#F7931A"}}>Contract ID</td>
                                <td className="px-3 py-2" style={{fontFamily: "monospace", wordBreak: "break-all"}}>
                                    {state?.contractId || id}
                                </td>
                            </tr>
                            <tr className="blockinfo-row">
                                <td className="px-3 py-2" style={{color: "#F7931A"}}>Code Hash</td>
                                <td className="px-3 py-2" style={{fontFamily: "monospace", wordBreak: "break-all"}}>
                                    {state?.codeHash || '-'}
                                </td>
                            </tr>
                            <tr className="blockinfo-row">
                                <td className="px-3 py-2" style={{color: "#F7931A"}}>Datum (State)</td>
                                <td className="px-3 py-2">
                                    {state?.datum ? (
                                        <pre style={{
                                            fontFamily: "monospace",
                                            fontSize: "small",
                                            maxHeight: "200px",
                                            overflow: "auto",
                                            background: "rgba(0,0,0,0.3)",
                                            padding: "0.5rem",
                                            borderRadius: "0.3rem",
                                            wordBreak: "break-all",
                                            whiteSpace: "pre-wrap",
                                            margin: 0
                                        }}>
                                            {state.datum}
                                        </pre>
                                    ) : <span className="text-muted">Empty</span>}
                                </td>
                            </tr>
                            <tr className="blockinfo-row">
                                <td className="px-3 py-2" style={{color: "#F7931A"}}>Deploy Transaction</td>
                                <td className="px-3 py-2">
                                    <Link to={`/txs/${state?.contractId || id}`} className="blockinfo-link"
                                          style={{fontFamily: "monospace", wordBreak: "break-all"}}>
                                        {state?.contractId || id}
                                    </Link>
                                </td>
                            </tr>
                            <tr className="blockinfo-row">
                                <td className="px-3 py-2" style={{color: "#F7931A"}}>WASM Code</td>
                                <td className="px-3 py-2">
                                    <button className="btn btn-sm btn-outline-warning" onClick={loadCode}>
                                        {showCode ? 'Hide Code' : 'View WASM Code'}
                                    </button>
                                    {code && (
                                        <span className="ms-2 text-muted" style={{fontSize: "small"}}>
                                            {code.codeSize} bytes
                                        </span>
                                    )}
                                </td>
                            </tr>
                            </tbody>
                        </table>

                        {showCode && code?.code && (
                            <div className="mt-3">
                                <h6 style={{color: "#F7931A"}}>WASM Bytecode (base64)</h6>
                                <pre style={{
                                    fontFamily: "monospace",
                                    fontSize: "x-small",
                                    maxHeight: "300px",
                                    overflow: "auto",
                                    background: "rgba(0,0,0,0.3)",
                                    padding: "0.5rem",
                                    borderRadius: "0.3rem",
                                    wordBreak: "break-all",
                                    whiteSpace: "pre-wrap",
                                    color: "#ccc"
                                }}>
                                    {code.code}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Invocations */}
                    <h4 className="text-light mt-4 mb-3">
                        Invocations <span className="text-muted" style={{fontSize: "small"}}>({invTotal})</span>
                    </h4>
                    {invocations.length === 0 ? (
                        <p className="text-muted">No invocations recorded.</p>
                    ) : (
                        <Table className="styled-table" borderless>
                            <thead>
                            <tr>
                                <th>Transaction</th>
                                <th className="d-none d-md-table-cell">Invoker</th>
                                <th>Block Height</th>
                            </tr>
                            </thead>
                            <tbody>
                            {invocations.map(inv => (
                                <tr key={inv.invokeTxId}>
                                    <td className="hashh">
                                        <Link to={`/txs/${inv.invokeTxId}`} className="blockinfo-link">
                                            {inv.invokeTxId}
                                        </Link>
                                    </td>
                                    <td className="d-none d-md-table-cell hashh">
                                        {inv.invokerAddress ? (
                                            <Link to={`/addresses/${inv.invokerAddress}`} className="blockinfo-link">
                                                {inv.invokerAddress}
                                            </Link>
                                        ) : '-'}
                                    </td>
                                    <td>{inv.blockHeight}</td>
                                </tr>
                            ))}
                            </tbody>
                        </Table>
                    )}
                </Col>
            </Row>
        </Container>
    );
};

export default ContractDetail;
