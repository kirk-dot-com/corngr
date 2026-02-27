import React, { useState, useCallback } from 'react';
import type { TxSnapshot, Posting, CreateInvMoveRequest } from './types';
import { useErpStore } from './store/useErpStore';

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

// ── AddLineForm ──────────────────────────────────────────────────────────────

interface AddLineFormProps {
    txId: string;
    onDone: () => void;
    onCancel: () => void;
}

const AddLineForm: React.FC<AddLineFormProps> = ({ txId, onDone, onCancel }) => {
    const store = useErpStore();
    const [qty, setQty] = useState('1');
    const [price, setPrice] = useState('0.00');
    const [description, setDescription] = useState('');
    const [effect, setEffect] = useState('none');
    const [taxRate, setTaxRate] = useState('0.1');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const result = await store.addLine({
            tx_id: txId,
            description,
            qty: parseFloat(qty),
            unit_price: parseFloat(price),
            inventory_effect: effect,
            tax_rate: parseFloat(taxRate),
        });
        setBusy(false);
        if (result) { onDone(); }
        else { setErr('Failed to add line — check console.'); }
    }, [store, txId, qty, price, description, effect, taxRate, onDone]);

    return (
        <form className="drill-inline-form" onSubmit={handleSubmit}>
            <div className="form-row">
                <label>Description <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Widget A…" /></label>
                <label>Qty <input type="number" value={qty} min="0.01" step="any" onChange={e => setQty(e.target.value)} style={{ width: 70 }} /></label>
                <label>Unit Price <input type="number" value={price} min="0" step="any" onChange={e => setPrice(e.target.value)} style={{ width: 90 }} /></label>
                <label>Inv Effect
                    <select value={effect} onChange={e => setEffect(e.target.value)}>
                        <option value="none">none</option>
                        <option value="increase">increase</option>
                        <option value="decrease">decrease</option>
                    </select>
                </label>
                <label>Tax Rate <input type="number" value={taxRate} min="0" max="1" step="0.01" onChange={e => setTaxRate(e.target.value)} style={{ width: 60 }} /></label>
            </div>
            {err && <p className="form-error">{err}</p>}
            <div className="form-actions">
                <button type="submit" className="action-btn approve" disabled={busy}>
                    {busy ? 'Adding…' : '＋ Add Line'}
                </button>
                <button type="button" className="action-btn void" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
};

// ── CreateInvMoveForm ────────────────────────────────────────────────────────

interface InvMoveFormProps {
    txId: string;
    onDone: () => void;
    onCancel: () => void;
}

const CreateInvMoveForm: React.FC<InvMoveFormProps> = ({ txId, onDone, onCancel }) => {
    const store = useErpStore();
    const [itemId, setItemId] = useState('');
    const [lineId, setLineId] = useState('');
    const [qty, setQty] = useState('1');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const req: CreateInvMoveRequest = {
            tx_id: txId,
            tx_line_id: lineId,
            item_id: itemId,
            qty_delta: parseFloat(qty),
        };
        const result = await store.createInvMove(req);
        setBusy(false);
        if (result) { onDone(); }
        else { setErr('Failed to create inventory move.'); }
    }, [store, txId, lineId, itemId, qty, onDone]);

    return (
        <form className="drill-inline-form" onSubmit={handleSubmit}>
            <div className="form-row">
                <label>Item ID <input value={itemId} onChange={e => setItemId(e.target.value)} placeholder="item_001" /></label>
                <label>Line ID <input value={lineId} onChange={e => setLineId(e.target.value)} placeholder="line UUID or leave blank" /></label>
                <label>Qty Δ <input type="number" value={qty} step="any" onChange={e => setQty(e.target.value)} style={{ width: 80 }} /></label>
            </div>
            {err && <p className="form-error">{err}</p>}
            <div className="form-actions">
                <button type="submit" className="action-btn approve" disabled={busy || !itemId}>
                    {busy ? 'Recording…' : '📦 Record Move'}
                </button>
                <button type="button" className="action-btn void" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
};

// ── PostingPreview ───────────────────────────────────────────────────────────

interface PostingPreviewProps {
    postings: Posting[];
    onConfirm: () => void;
    onCancel: () => void;
    busy: boolean;
}

const PostingPreview: React.FC<PostingPreviewProps> = ({ postings, onConfirm, onCancel, busy }) => {
    const totalDr = postings.reduce((s, p) => s + p.debit_amount, 0);
    const totalCr = postings.reduce((s, p) => s + p.credit_amount, 0);
    const balanced = Math.abs(totalDr - totalCr) < 0.001;

    return (
        <div className="posting-preview">
            <div className="posting-preview-header">
                📊 Posting Preview — confirm before posting
            </div>
            <table className="drill-table">
                <thead>
                    <tr><th>Account</th><th>Debit</th><th>Credit</th></tr>
                </thead>
                <tbody>
                    {postings.map(p => (
                        <tr key={p.posting_id}>
                            <td>{p.account_id}</td>
                            <td>{p.debit_amount > 0 ? `$${p.debit_amount.toFixed(2)}` : '—'}</td>
                            <td>{p.credit_amount > 0 ? `$${p.credit_amount.toFixed(2)}` : '—'}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td><strong>Totals</strong></td>
                        <td><strong>${totalDr.toFixed(2)}</strong></td>
                        <td><strong>${totalCr.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>
            {!balanced && (
                <p className="form-error">⚠ Postings are unbalanced (Δ {(totalDr - totalCr).toFixed(4)}). Review lines before posting.</p>
            )}
            <div className="form-actions">
                <button
                    className="action-btn post"
                    onClick={onConfirm}
                    disabled={!balanced || busy}
                >
                    {busy ? 'Posting…' : '✓ Confirm Post'}
                </button>
                <button className="action-btn void" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
};

// ── TxActionBar ──────────────────────────────────────────────────────────────

type InlineMode = null | 'add_line' | 'add_move' | 'posting_preview';

interface TxActionBarProps {
    tx: TxSnapshot;
    onRefresh: () => void;
}

const TxActionBar: React.FC<TxActionBarProps> = ({ tx, onRefresh }) => {
    const store = useErpStore();
    const [mode, setMode] = useState<InlineMode>(null);
    const [previewPostings, setPreviewPostings] = useState<Posting[]>([]);
    const [postBusy, setPostBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const handleTransition = useCallback(async (target: 'proposed' | 'approved' | 'void') => {
        setMsg(null);
        const res = await store.transitionStatus(tx.tx_id, target);
        if (res) {
            setMsg(`✓ Status updated to ${target}`);
            onRefresh();
        } else {
            setMsg(`✗ Could not transition to ${target} — check role / state`);
        }
    }, [store, tx.tx_id, onRefresh]);

    const handleApproveClick = useCallback(async () => {
        setMsg(null);
        // First generate postings so the user can preview them
        const postings = await store.generatePostings(tx.tx_id);
        if (postings.length === 0) {
            setMsg('No postings generated — add at least one line first.');
            return;
        }
        setPreviewPostings(postings);
        setMode('posting_preview');
    }, [store, tx.tx_id]);

    const handleConfirmPost = useCallback(async () => {
        setPostBusy(true);
        // Transition to approved first (Phase A: auto-approve after preview)
        await store.transitionStatus(tx.tx_id, 'approved');
        const res = await store.postTx(tx.tx_id, previewPostings, []);
        setPostBusy(false);
        if (res) {
            setMode(null);
            setMsg('✓ Transaction posted — ledger updated');
            onRefresh();
        } else {
            setMsg('✗ Post failed — see error above');
        }
    }, [store, tx.tx_id, previewPostings, onRefresh]);

    if (tx.status === 'posted' || tx.status === 'void') return null;

    return (
        <div className="tx-action-bar">
            {/* Action buttons */}
            {mode === null && (
                <div className="action-btn-row">
                    {tx.status === 'draft' && (
                        <>
                            <button className="action-btn add" id="drill-add-line-btn"
                                onClick={() => setMode('add_line')}>
                                ＋ Add Line
                            </button>
                            <button className="action-btn add" id="drill-add-move-btn"
                                onClick={() => setMode('add_move')}>
                                📦 Add InvMove
                            </button>
                            <button className="action-btn propose" id="drill-propose-btn"
                                onClick={() => handleTransition('proposed')}>
                                → Propose
                            </button>
                        </>
                    )}
                    {tx.status === 'proposed' && (
                        <>
                            <button className="action-btn approve" id="drill-approve-btn"
                                onClick={handleApproveClick}>
                                ✓ Approve &amp; Preview Post
                            </button>
                            <button className="action-btn void" id="drill-void-btn"
                                onClick={() => handleTransition('void')}>
                                Void
                            </button>
                        </>
                    )}
                    {tx.status === 'approved' && (
                        <>
                            <button className="action-btn post" id="drill-post-btn"
                                onClick={handleApproveClick}>
                                🔒 Post
                            </button>
                            <button className="action-btn void" id="drill-void-btn"
                                onClick={() => handleTransition('void')}>
                                Void
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Inline forms */}
            {mode === 'add_line' && (
                <AddLineForm
                    txId={tx.tx_id}
                    onDone={() => { setMode(null); setMsg('✓ Line added'); onRefresh(); }}
                    onCancel={() => setMode(null)}
                />
            )}
            {mode === 'add_move' && (
                <CreateInvMoveForm
                    txId={tx.tx_id}
                    onDone={() => { setMode(null); setMsg('✓ InvMove recorded'); onRefresh(); }}
                    onCancel={() => setMode(null)}
                />
            )}
            {mode === 'posting_preview' && (
                <PostingPreview
                    postings={previewPostings}
                    onConfirm={handleConfirmPost}
                    onCancel={() => setMode(null)}
                    busy={postBusy}
                />
            )}

            {msg && <div className="action-msg">{msg}</div>}
        </div>
    );
};

// ── DrillPanel ───────────────────────────────────────────────────────────────

export const DrillPanel: React.FC<DrillPanelProps> = ({ tx: initialTx, onClose }) => {
    const [tab, setTab] = useState<DrillTab>('overview');
    // Local tx copy updated after actions
    const [tx, setTx] = useState<TxSnapshot>(initialTx);
    const store = useErpStore();

    const handleRefresh = useCallback(async () => {
        // Refresh to get latest status/counts
        await store.refreshAll();
        // Find updated snapshot from the store
        const updated = store.transactions.find(t => t.tx_id === tx.tx_id);
        if (updated) setTx(updated);
    }, [store, tx.tx_id]);

    // Close on ESC
    const handleOverlayKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

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

                {/* Action Bar */}
                <TxActionBar tx={tx} onRefresh={handleRefresh} />

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
                            <div className="erp-empty-state">
                                <span className="empty-icon">📋</span>
                                <p>No lines yet. Use the <strong>＋ Add Line</strong> button above.</p>
                            </div>
                        ) : (
                            <div className="erp-empty-state">
                                <span className="empty-icon">📋</span>
                                <p>{tx.line_count} line(s) on record. Detailed line view in Phase B (erp_get_tx_snapshot with include_lines).</p>
                            </div>
                        )
                    )}

                    {tab === 'postings' && (
                        tx.status === 'draft' || tx.status === 'proposed' ? (
                            <div className="erp-empty-state">
                                <span className="empty-icon">💳</span>
                                <p>Postings are finalized at post stage. Current status: <strong>{tx.status}</strong>.</p>
                                <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 6 }}>
                                    Approve &amp; Post this transaction to see the finalized postings in the Ledger.
                                </p>
                            </div>
                        ) : (
                            <div className="erp-empty-state">
                                <span className="empty-icon">✅</span>
                                <p>Transaction is <strong>{tx.status}</strong>. View postings in the 📒 Ledger panel for account balances.</p>
                            </div>
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
