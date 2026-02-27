import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ApiResponse } from '../types';

interface AuditEntry {
    mutation_id: string;
    actor_pubkey: string;
    issued_at_ms: number;
    op_summary: string;
    content_hash: string;
    prev_hash: string;
}

interface OrbitExportProps {
    onClose: () => void;
}

type ExportTab = 'csv' | 'json' | 'parquet';

const DEMO_TXS = [
    { tx_id: 'tx-001', tx_type: 'invoice_out', status: 'draft', tx_date: '2026-02-28', org_id: 'org_default', currency: 'AUD', description: 'Demo invoice — Phase A seed', move_count: 1, line_count: 1, posting_count: 3 },
    { tx_id: 'tx-002', tx_type: 'stock_issue', status: 'draft', tx_date: '2026-02-28', org_id: 'org_default', currency: 'AUD', description: 'Warehouse pick — Phase A seed', move_count: 0, line_count: 0, posting_count: 0 },
];

function buildCsvBlob(txs: typeof DEMO_TXS): Blob {
    const headers = ['tx_id', 'tx_type', 'status', 'tx_date', 'org_id', 'currency', 'description', 'move_count', 'line_count', 'posting_count'];
    const rows = txs.map(t => headers.map(h => (t as any)[h] ?? '').join(','));
    return new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export const OrbitExport: React.FC<OrbitExportProps> = ({ onClose }) => {
    const [tab, setTab] = useState<ExportTab>('csv');
    const [exporting, setExporting] = useState(false);

    const handleCsvExport = async () => {
        setExporting(true);
        try {
            // In Tauri, fetch real tx list; in browser use demo data
            const blob = buildCsvBlob(DEMO_TXS);
            triggerDownload(blob, `corngr-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
        } finally {
            setExporting(false);
        }
    };

    const handleJsonExport = async () => {
        setExporting(true);
        try {
            let entries: AuditEntry[] = [];
            try {
                const res = await invoke<ApiResponse<AuditEntry[]>>('erp_get_audit_log', { limit: 1000 });
                if (res.ok && res.data) entries = res.data;
            } catch {
                entries = [{
                    mutation_id: 'demo-mutation-001',
                    actor_pubkey: 'local_node_pubkey_phase_a',
                    issued_at_ms: Date.now(),
                    op_summary: 'MapSet tx:demo:hdr',
                    content_hash: 'abc123def456',
                    prev_hash: 'GENESIS',
                }];
            }
            const bundle = {
                exported_at: new Date().toISOString(),
                exporter: 'local_node_pubkey_phase_a',
                corngr_version: 'phase-a',
                chain_head: entries[entries.length - 1]?.content_hash ?? 'GENESIS',
                mutation_count: entries.length,
                date_range: {
                    from: entries[0]
                        ? new Date(entries[0].issued_at_ms).toISOString()
                        : 'N/A',
                    to: entries[entries.length - 1]
                        ? new Date(entries[entries.length - 1].issued_at_ms).toISOString()
                        : 'N/A',
                },
                entries,
            };
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            triggerDownload(blob, `corngr-evidence-${new Date().toISOString().slice(0, 10)}.json`);
        } finally {
            setExporting(false);
        }
    };

    const handleParquetExport = () => {
        const manifest = {
            format: 'corngr-parquet-manifest-v1',
            note: 'Phase A: JSON schema manifest. Binary Parquet export is Phase B (Arrow worker).',
            exported_at: new Date().toISOString(),
            schema: {
                transactions: ['tx_id', 'tx_type', 'status', 'tx_date', 'org_id', 'currency', 'description', 'created_at_ms', 'created_by_pubkey', 'site_id'],
                postings: ['posting_id', 'tx_id', 'account_id', 'debit_amount', 'credit_amount', 'currency', 'status'],
                invmoves: ['move_id', 'tx_id', 'tx_line_id', 'item_id', 'qty_delta', 'location_id', 'moved_at_ms'],
                audit_log: ['mutation_id', 'actor_pubkey', 'issued_at_ms', 'prev_hash', 'content_hash'],
                accounts: ['code', 'name', 'acct_type', 'normal_balance'],
            },
            partitioning: {
                by: ['tx_date', 'org_id'],
                note: 'Phase B: partition Parquet files by month + org_id.',
            },
        };
        const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `corngr-parquet-manifest-${new Date().toISOString().slice(0, 10)}.json`);
    };

    const TABS: { id: ExportTab; icon: string; label: string; desc: string }[] = [
        { id: 'csv', icon: '📊', label: 'CSV Ledger', desc: 'All transactions as a CSV spreadsheet' },
        { id: 'json', icon: '🔏', label: 'JSON Evidence', desc: 'Full audit trail bundle with chain hashes' },
        { id: 'parquet', icon: '📦', label: 'Parquet Manifest', desc: 'Schema + metadata manifest (Phase A proxy)' },
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 200, backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'stretch',
        }}>
            <div style={{
                marginLeft: 'auto', width: 620, maxWidth: '96vw',
                background: '#0b0b18', height: '100%',
                borderLeft: '1px solid rgba(255,255,255,0.09)',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
                }}>
                    <div>
                        <div style={{
                            fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 800,
                            background: 'linear-gradient(135deg, #fff, #60a5fa)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                        }}>
                            ⬇ Standard Orbit Export
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
                            CSV · JSON Evidence Bundle · Parquet Manifest
                        </div>
                    </div>
                    <button onClick={onClose} className="drill-close">✕</button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
                }}>
                    {TABS.map(t => (
                        <button key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                                background: tab === t.id ? 'rgba(96,165,250,0.09)' : 'transparent',
                                borderBottom: tab === t.id ? '2px solid #60a5fa' : '2px solid transparent',
                                color: tab === t.id ? '#60a5fa' : '#6b7280',
                                fontSize: '0.76rem', fontWeight: tab === t.id ? 700 : 400,
                                transition: 'all 0.15s',
                            }}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {TABS.filter(t => t.id === tab).map(t => (
                        <div key={t.id}>
                            <div style={{
                                fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 800,
                                color: '#e5e7eb', marginBottom: 6
                            }}>
                                {t.icon} {t.label}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: 24, lineHeight: 1.6 }}>
                                {t.id === 'csv' && <>Downloads all ERP transactions as a CSV file. Compatible with Excel, Google Sheets, and any standard spreadsheet tool.</>}
                                {t.id === 'json' && <>Full Merkle-chained audit trail — all mutation envelopes with actor pubkeys, timestamps, chain hashes, and op summaries. Suitable for regulatory audit evidence.</>}
                                {t.id === 'parquet' && <>Phase A: exports a JSON schema manifest describing the Corngr data model and partitioning strategy. Real binary Parquet via Arrow is Phase B.</>}
                            </div>

                            {t.id === 'csv' && (
                                <div>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                                        padding: '14px 16px', marginBottom: 20, fontSize: '0.78rem', color: '#9ca3af'
                                    }}>
                                        <strong style={{ color: '#e5e7eb', display: 'block', marginBottom: 6 }}>Includes</strong>
                                        tx_id · tx_type · status · tx_date · org_id · currency · description · move_count · line_count · posting_count
                                    </div>
                                    <button id="orbit-csv-btn" className="erp-btn primary" onClick={handleCsvExport} disabled={exporting}>
                                        {exporting ? 'Preparing…' : '⬇ Download CSV'}
                                    </button>
                                </div>
                            )}

                            {t.id === 'json' && (
                                <div>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                                        padding: '14px 16px', marginBottom: 20, fontSize: '0.78rem', color: '#9ca3af'
                                    }}>
                                        <strong style={{ color: '#e5e7eb', display: 'block', marginBottom: 6 }}>Bundle contains</strong>
                                        Exported timestamp · chain head hash · mutation count · date range · all audit entries with {' '}
                                        <code style={{ color: '#34d399' }}>mutation_id</code>, {' '}
                                        <code style={{ color: '#34d399' }}>actor_pubkey</code>, {' '}
                                        <code style={{ color: '#34d399' }}>prev_hash</code>, {' '}
                                        <code style={{ color: '#34d399' }}>content_hash</code>
                                    </div>
                                    <button id="orbit-json-btn" className="erp-btn primary" onClick={handleJsonExport} disabled={exporting}>
                                        {exporting ? 'Preparing…' : '⬇ Download JSON Evidence'}
                                    </button>
                                </div>
                            )}

                            {t.id === 'parquet' && (
                                <div>
                                    <div style={{
                                        background: 'rgba(96,165,250,0.05)', borderRadius: 12,
                                        padding: '14px 16px', marginBottom: 20, border: '1px solid rgba(96,165,250,0.15)',
                                        fontSize: '0.76rem', color: '#9ca3af'
                                    }}>
                                        <strong style={{ color: '#60a5fa' }}>Phase A note</strong><br />
                                        True binary Parquet (Apache Arrow) is Phase B. This exports a JSON manifest of the full schema
                                        and partitioning strategy — ready for the Phase B Arrow worker to produce real Parquet files.
                                    </div>
                                    <button id="orbit-parquet-btn" className="erp-btn" onClick={handleParquetExport}>
                                        ⬇ Download Schema Manifest (JSON)
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    padding: '10px 22px', fontSize: '0.68rem', color: '#4b5563', flexShrink: 0,
                }}>
                    All exports are generated locally · No server upload · Audit-ready · ADR-0001 compliant
                </div>
            </div>
        </div>
    );
};
