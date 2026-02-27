import React, { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ApiResponse } from '../types';
import { TimeScrubber } from './TimeScrubber';
import { EvidenceExporter } from './EvidenceExporter';

export interface AuditEntryView {
    mutation_id: string;
    actor_pubkey: string;
    issued_at_ms: number;
    op_count: number;
    prev_hash: string;
    content_hash: string;
    chain_hash: string;
    op_summary: string;
}

interface AuditExplorerProps {
    onClose: () => void;
}

export const AuditExplorer: React.FC<AuditExplorerProps> = ({ onClose }) => {
    const [entries, setEntries] = useState<AuditEntryView[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<AuditEntryView | null>(null);
    const [showExporter, setShowExporter] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const loadLog = useCallback(async () => {
        setLoading(true);
        try {
            const res = await invoke<ApiResponse<AuditEntryView[]>>('erp_get_audit_log', { limit: 100 });
            if (res.ok && res.data) setEntries(res.data);
        } catch {
            // Tauri not available in browser — show empty state with placeholder
            setEntries([{
                mutation_id: 'demo-mutation-001',
                actor_pubkey: 'local_node_pubkey_phase_a',
                issued_at_ms: Date.now() - 120_000,
                op_count: 7,
                prev_hash: 'genesis',
                content_hash: 'sha256:a3f4b1c2d5e6…',
                chain_hash: 'sha256:9b2e7f3a1d4c…',
                op_summary: 'MapSet tx:demo:hdr .status = draft',
            }, {
                mutation_id: 'demo-mutation-002',
                actor_pubkey: 'local_node_pubkey_phase_a',
                issued_at_ms: Date.now() - 60_000,
                op_count: 2,
                prev_hash: 'sha256:a3f4b1c2d5e6…',
                content_hash: 'sha256:c7d8e9f0a1b2…',
                chain_hash: 'sha256:1a2b3c4d5e6f…',
                op_summary: 'MapSet txline:demo-L1:data .qty = 10',
            }]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLog();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [loadLog, onClose]);

    const timestamps = entries.map(e => e.issued_at_ms).sort((a, b) => a - b);

    return (
        <>
            {/* Overlay */}
            <div
                ref={overlayRef}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
                    zIndex: 200, backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'stretch',
                }}
                onClick={e => { if (e.target === overlayRef.current) onClose(); }}
            >
                {/* Panel */}
                <div style={{
                    marginLeft: 'auto', width: 700, maxWidth: '95vw',
                    background: '#0b0b18', height: '100%',
                    borderLeft: '1px solid rgba(255,255,255,0.09)',
                    display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s ease',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                        flexShrink: 0,
                    }}>
                        <div>
                            <div style={{
                                fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 800,
                                background: 'linear-gradient(135deg, #fff, #667eea)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                            }}>
                                🔍 Audit Explorer
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
                                {entries.length} mutation{entries.length !== 1 ? 's' : ''} on chain
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button id="audit-export-btn"
                                onClick={() => setShowExporter(true)}
                                className="erp-btn"
                                style={{ fontSize: '0.76rem' }}
                            >
                                📦 Export Evidence Bundle
                            </button>
                            <button onClick={onClose} className="drill-close">✕</button>
                        </div>
                    </div>

                    {/* Time Scrubber */}
                    {timestamps.length > 0 && (
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                            <TimeScrubber timestamps={timestamps} />
                        </div>
                    )}

                    {/* Log Table + Side Detail */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Entry list */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading ? (
                                <div style={{ padding: 30, color: '#6b7280', textAlign: 'center', fontSize: '0.84rem' }}>
                                    Loading audit log…
                                </div>
                            ) : entries.length === 0 ? (
                                <div className="erp-empty-state" style={{ padding: 40 }}>
                                    <span className="empty-icon">📜</span>
                                    <p>No mutations in audit log yet. Create a transaction to start the chain.</p>
                                </div>
                            ) : (
                                <table className="drill-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Mutation ID</th>
                                            <th>Actor</th>
                                            <th>Timestamp</th>
                                            <th>Ops</th>
                                            <th>Summary</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map(e => (
                                            <tr
                                                key={e.mutation_id}
                                                onClick={() => setSelected(selected?.mutation_id === e.mutation_id ? null : e)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: selected?.mutation_id === e.mutation_id
                                                        ? 'rgba(102,126,234,0.12)' : undefined,
                                                }}
                                            >
                                                <td style={{
                                                    color: '#818cf8', maxWidth: 110, overflow: 'hidden',
                                                    textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize: '0.72rem'
                                                }}>
                                                    {e.mutation_id.slice(0, 14)}…
                                                </td>
                                                <td style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                                    {e.actor_pubkey.slice(0, 12)}…
                                                </td>
                                                <td style={{ fontSize: '0.72rem', color: '#d1d5db', whiteSpace: 'nowrap' }}>
                                                    {new Date(e.issued_at_ms).toLocaleString()}
                                                </td>
                                                <td style={{
                                                    textAlign: 'center', color: '#fbbf24', fontWeight: 700,
                                                    fontSize: '0.78rem'
                                                }}>{e.op_count}</td>
                                                <td style={{
                                                    maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                                                    color: '#e5e7eb', fontSize: '0.72rem', fontFamily: 'monospace'
                                                }}>
                                                    {e.op_summary}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Selected entry detail */}
                        {selected && (
                            <div style={{
                                width: 280, borderLeft: '1px solid rgba(255,255,255,0.07)',
                                overflowY: 'auto', padding: '16px 16px', flexShrink: 0,
                                background: 'rgba(102,126,234,0.04)',
                            }}>
                                <div style={{
                                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1,
                                    textTransform: 'uppercase', color: '#6b7280', marginBottom: 12
                                }}>
                                    Entry Detail
                                </div>
                                {[
                                    ['Mutation ID', selected.mutation_id],
                                    ['Actor Pubkey', selected.actor_pubkey],
                                    ['Issued At', new Date(selected.issued_at_ms).toLocaleString()],
                                    ['Op Count', String(selected.op_count)],
                                    ['Op Summary', selected.op_summary],
                                    ['Content Hash', selected.content_hash],
                                    ['Prev Hash', selected.prev_hash],
                                    ['Chain Hash', selected.chain_hash],
                                ].map(([k, v]) => (
                                    <div key={k} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        padding: '7px 0',
                                    }}>
                                        <div style={{
                                            fontSize: '0.62rem', color: '#6b7280', fontWeight: 700,
                                            textTransform: 'uppercase', marginBottom: 2
                                        }}>{k}</div>
                                        <div style={{
                                            fontFamily: 'monospace', fontSize: '0.72rem', color: '#e5e7eb',
                                            wordBreak: 'break-all'
                                        }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showExporter && (
                <EvidenceExporter entries={entries} onClose={() => setShowExporter(false)} />
            )}
        </>
    );
};
