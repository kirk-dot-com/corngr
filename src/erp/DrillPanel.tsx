import React, { useState } from 'react';
import type { TxSnapshot } from './types';

interface DrillPanelProps {
    tx: TxSnapshot;
    onClose: () => void;
}

type DrillTab = 'overview' | 'lines' | 'postings' | 'audit';

const TX_TYPE_LABEL: Record<string, string> = {
    invoice_out: 'Invoice Out', invoice_in: 'Invoice In',
    payment_in: 'Payment In', payment_out: 'Payment Out',
    stock_receipt: 'Stock Receipt', stock_issue: 'Stock Issue',
    stock_adjust: 'Stock Adjust', journal: 'Journal',
    credit_note: 'Credit Note', debit_note: 'Debit Note',
};

export const DrillPanel: React.FC<DrillPanelProps> = ({ tx, onClose }) => {
    const [tab, setTab] = useState<DrillTab>('overview');

    // Close on overlay click / ESC
    const handleOverlayKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    // Phase A: line / posting data is shown as metadata placeholders.
    // Phase B: loaded via erp_get_tx_snapshot with include_audit_refs=true.
    const mockAuditData = {
        mutation_id: `mut-${tx.tx_id.slice(0, 8)}-0001`,
        actor_pubkey: 'local_node_pubkey_phase_a',
        issued_at_ms: Date.now() - 60_000,
        prev_hash: 'genesis',
        content_hash: 'sha256:' + tx.tx_id.replace(/-/g, '').slice(0, 16) + '…',
        signature_ref: 'ed25519:' + tx.tx_id.replace(/-/g, '').slice(0, 32) + '…',
        envelope_version: '1',
    };

    return (
        <>
            <div className="drill-panel-overlay" onClick={onClose} onKeyDown={handleOverlayKey} tabIndex={-1} />
            <div className="drill-panel" role="dialog" aria-modal="true">
                {/* Header */}
                <div className="drill-header">
                    <div>
                        <div className="drill-title">
                            {TX_TYPE_LABEL[tx.tx_type] ?? tx.tx_type} — Drill to Source
                        </div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className={`status-badge ${tx.status}`}>{tx.status}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6366f1' }}>
                                {tx.tx_id}
                            </span>
                        </div>
                    </div>
                    <button className="drill-close" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div className="drill-tabs">
                    {(['overview', 'lines', 'postings', 'audit'] as DrillTab[]).map(t => (
                        <button key={t} className={`drill-tab ${tab === t ? 'active' : ''}`}
                            onClick={() => setTab(t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="drill-body">
                    {tab === 'overview' && (
                        <div>
                            {[
                                ['Tx ID', tx.tx_id],
                                ['Type', TX_TYPE_LABEL[tx.tx_type] ?? tx.tx_type],
                                ['Status', tx.status],
                                ['Org', tx.org_id],
                                ['Site', tx.site_id],
                                ['Lines', String(tx.line_count)],
                                ['Inventory Moves', String(tx.move_count)],
                            ].map(([k, v]) => (
                                <div key={k} className="audit-row">
                                    <span className="audit-key">{k}</span>
                                    <span className="audit-val">{v}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'lines' && (
                        tx.line_count === 0 ? (
                            <div className="erp-empty-state"><span className="empty-icon">📋</span><p>No lines on this transaction yet.</p></div>
                        ) : (
                            <table className="drill-table">
                                <thead>
                                    <tr>
                                        <th>Line ID</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Effect</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>{tx.tx_id.slice(0, 8)}-L1</td>
                                        <td>item_001</td>
                                        <td>10</td>
                                        <td>$99.99</td>
                                        <td>decrease</td>
                                    </tr>
                                </tbody>
                            </table>
                        )
                    )}

                    {tab === 'postings' && (
                        tx.status === 'draft' ? (
                            <div className="erp-empty-state">
                                <span className="empty-icon">💳</span>
                                <p>Postings are generated at approve/post stage. Status: {tx.status}.</p>
                            </div>
                        ) : (
                            <table className="drill-table">
                                <thead>
                                    <tr><th>Account</th><th>Debit</th><th>Credit</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    <tr><td>accounts_receivable</td><td>$1,099.89</td><td>—</td><td>draft</td></tr>
                                    <tr><td>revenue</td><td>—</td><td>$999.90</td><td>draft</td></tr>
                                    <tr><td>tax_payable</td><td>—</td><td>$99.99</td><td>draft</td></tr>
                                </tbody>
                            </table>
                        )
                    )}

                    {tab === 'audit' && (
                        <div>
                            <div style={{
                                marginBottom: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.08)',
                                borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)',
                                fontSize: '0.74rem', color: '#a5b4fc'
                            }}>
                                🔐 Audit lineage: posting → tx → tx_line → invmove → approval → mutation_envelope
                            </div>
                            {Object.entries(mockAuditData).map(([k, v]) => (
                                <div key={k} className="audit-row">
                                    <span className="audit-key">{k}</span>
                                    <span className="audit-val">
                                        {k === 'issued_at_ms'
                                            ? new Date(v as number).toLocaleString()
                                            : String(v)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
