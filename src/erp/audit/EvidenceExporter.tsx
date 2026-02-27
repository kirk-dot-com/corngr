import React, { useState } from 'react';
import type { AuditEntryView } from './AuditExplorer';

interface EvidenceExporterProps {
    entries: AuditEntryView[];
    onClose: () => void;
}

export const EvidenceExporter: React.FC<EvidenceExporterProps> = ({ entries, onClose }) => {
    const [exported, setExported] = useState(false);

    const handleExport = () => {
        const bundle = {
            bundle_version: '1',
            exported_at: new Date().toISOString(),
            exported_at_ms: Date.now(),
            org_id: 'org_default',
            entry_count: entries.length,
            chain_head: entries[0]?.chain_hash ?? 'genesis',
            chain_tail: entries[entries.length - 1]?.chain_hash ?? 'genesis',
            phase: 'A',
            note: 'Evidence bundle — Corngr-ERP Phase A. All entries are Merkle-chained MutationEnvelopes signed with Ed25519.',
            entries: entries,
        };

        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `erp_evidence_bundle_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setExported(true);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
        }}>
            <div style={{
                background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 18, padding: 32, maxWidth: 440, width: '90vw',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}>
                <div style={{
                    fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 800,
                    color: '#f0f0f5', marginBottom: 8
                }}>
                    📦 Export Evidence Bundle
                </div>
                <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 20, lineHeight: 1.6 }}>
                    Exports a signed JSON bundle containing <strong style={{ color: '#e5e7eb' }}>
                        {entries.length} mutation envelope{entries.length !== 1 ? 's' : ''}</strong> with full
                    Merkle chain linkage — suitable for auditor review or regulatory submission.
                </div>

                <div style={{
                    background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: '0.74rem',
                    color: '#fbbf24', lineHeight: 1.5,
                }}>
                    ⚠ <strong>Phase A:</strong> JSON format only. PDF/A export is planned for Phase B.
                </div>

                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                    {[
                        ['Mutations', entries.length],
                        ['Chain Head', (entries[0]?.chain_hash ?? 'genesis').slice(0, 14) + '…'],
                        ['From', entries.length > 0 ? new Date(Math.min(...entries.map(e => e.issued_at_ms))).toLocaleDateString() : '—'],
                        ['To', entries.length > 0 ? new Date(Math.max(...entries.map(e => e.issued_at_ms))).toLocaleDateString() : '—'],
                    ].map(([k, v]) => (
                        <div key={String(k)} style={{
                            background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                            padding: '8px 12px',
                        }}>
                            <div style={{
                                fontSize: '0.62rem', color: '#6b7280', textTransform: 'uppercase',
                                letterSpacing: '0.8px', marginBottom: 3
                            }}>{k}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#e5e7eb' }}>{v}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        id="evidence-download-btn"
                        onClick={handleExport}
                        className="erp-btn primary"
                        style={{ flex: 1, justifyContent: 'center' }}
                    >
                        {exported ? '✓ Downloaded' : '⬇ Download JSON'}
                    </button>
                    <button onClick={onClose} className="erp-btn" style={{ minWidth: 80, justifyContent: 'center' }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
