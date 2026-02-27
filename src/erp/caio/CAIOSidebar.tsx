import React from 'react';
import type { CaioProposal, CreateTxRequest } from '../types';

const PROPOSAL_ICONS: Record<string, string> = {
    reorder_proposal: '📦',
    draft_invoice: '🧾',
    anomaly_flag: '⚠️',
    briefing: '🌅',
};

interface CAIOSidebarProps {
    proposals: CaioProposal[];
    briefingBullets: string[];
    onAccept: (payload: Partial<CreateTxRequest>) => void;
    onDismiss: (id: string) => void;
}

export const CAIOSidebar: React.FC<CAIOSidebarProps> = ({
    proposals,
    briefingBullets,
    onAccept,
    onDismiss,
}) => {
    return (
        <aside className="caio-sidebar">
            <div className="caio-header">
                <div className="caio-title">✦ CAIO Guardian</div>
                <div className="caio-mode-badge">Proposal-Only Mode</div>
            </div>

            <div className="caio-body">
                {/* Morning Briefing */}
                <div className="caio-section-label">☀ Morning Briefing</div>
                <div className="morning-briefing">
                    {briefingBullets.map((bullet, i) => (
                        <div key={i} className="briefing-bullet">
                            <span className="briefing-dot">▸</span>
                            <span>{bullet}</span>
                        </div>
                    ))}
                </div>

                {/* Proposals */}
                <div className="caio-section-label">
                    💡 Proposals
                    {proposals.length > 0 && (
                        <span style={{
                            marginLeft: 6, background: 'rgba(245,158,11,0.25)',
                            color: '#fbbf24', borderRadius: 10, padding: '0 7px',
                            fontSize: '0.62rem', fontWeight: 700,
                        }}>
                            {proposals.length}
                        </span>
                    )}
                </div>

                {proposals.length === 0 ? (
                    <div style={{
                        color: 'rgba(156,163,175,0.6)', fontSize: '0.76rem',
                        padding: '12px 0', textAlign: 'center'
                    }}>
                        No proposals — ledger looks healthy ✓
                    </div>
                ) : (
                    proposals.map(p => (
                        <div key={p.id} className="proposal-card">
                            <div className="proposal-type">
                                {PROPOSAL_ICONS[p.type] ?? '💡'} {p.type.replace(/_/g, ' ')}
                            </div>
                            <div className="proposal-title">{p.title}</div>
                            <div className="proposal-rationale">{p.rationale}</div>
                            <div className="proposal-source">↳ {p.source_fragment}</div>
                            <div className="proposal-actions">
                                <button
                                    className="proposal-btn accept"
                                    onClick={() => p.payload && onAccept(p.payload)}
                                    disabled={!p.payload}
                                    title={!p.payload ? 'No action payload for this proposal type' : undefined}
                                >
                                    Accept
                                </button>
                                <button className="proposal-btn dismiss" onClick={() => onDismiss(p.id)}>
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    ))
                )}

                {/* Phase A disclaimer */}
                <div style={{
                    marginTop: 20, padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.68rem', color: 'rgba(156,163,175,0.6)', lineHeight: 1.5,
                }}>
                    <strong style={{ color: 'rgba(245,158,11,0.6)' }}>Phase A</strong> — CAIO uses deterministic
                    rules. Local LLM (3–4B class) integration is planned for Phase B.
                    All proposals create <em>proposal_create</em> ops only; no direct mutations.
                </div>
            </div>
        </aside>
    );
};
