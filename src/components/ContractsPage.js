import {useEffect, useState} from "react";
import {Col, Container, Row, Spinner, Table} from "react-bootstrap";
import {Link} from "react-router-dom";
import {getContracts} from "../bunkernet-api-client";

const ContractsPage = () => {
    const [contracts, setContracts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const limit = 20;

    useEffect(() => {
        loadContracts();
    }, [page]);

    const loadContracts = async () => {
        setLoading(true);
        try {
            const data = await getContracts(limit, page * limit);
            setContracts(data.contracts || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error("Failed to load contracts:", err);
        }
        setLoading(false);
    };

    return (
        <Container className="webpage mt-4" fluid>
            <Row>
                <Col>
                    <h3 className="text-light mb-3">
                        <i className="fa fa-file-code-o me-2"/>Smart Contracts
                        <span className="ms-2" style={{fontSize: "small", color: "#8B5E1A"}}>
                            {total} deployed
                        </span>
                    </h3>
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary"/>
                        </div>
                    ) : contracts.length === 0 ? (
                        <div className="text-light text-center py-5">
                            No contracts deployed yet.
                        </div>
                    ) : (
                        <>
                            <Table className="styled-table" borderless>
                                <thead>
                                <tr>
                                    <th>Contract ID</th>
                                    <th>Code Hash</th>
                                    <th className="d-none d-md-table-cell">Code Size</th>
                                    <th className="d-none d-md-table-cell">Deployer</th>
                                    <th>Block Height</th>
                                </tr>
                                </thead>
                                <tbody>
                                {contracts.map(c => (
                                    <tr key={c.contractId} onClick={() => window.location.href = `/contracts/${c.contractId}`}
                                        style={{cursor: "pointer"}}>
                                        <td className="hashh">
                                            <Link to={`/contracts/${c.contractId}`} className="blockinfo-link">
                                                {c.contractId}
                                            </Link>
                                        </td>
                                        <td className="hashh">{c.codeHash || '-'}</td>
                                        <td className="d-none d-md-table-cell">{c.codeSize ? `${c.codeSize} B` : '-'}</td>
                                        <td className="d-none d-md-table-cell hashh">
                                            {c.deployerAddress ? (
                                                <Link to={`/addresses/${c.deployerAddress}`} className="blockinfo-link">
                                                    {c.deployerAddress}
                                                </Link>
                                            ) : '-'}
                                        </td>
                                        <td>{c.blockHeight}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </Table>
                            <div className="d-flex justify-content-center gap-3 mb-4">
                                <button className="btn btn-sm btn-outline-light" disabled={page === 0}
                                        onClick={() => setPage(p => p - 1)}>Prev
                                </button>
                                <span className="text-light align-self-center">
                                    Page {page + 1} of {Math.ceil(total / limit)}
                                </span>
                                <button className="btn btn-sm btn-outline-light"
                                        disabled={(page + 1) * limit >= total}
                                        onClick={() => setPage(p => p + 1)}>Next
                                </button>
                            </div>
                        </>
                    )}
                </Col>
            </Row>
        </Container>
    );
};

export default ContractsPage;
