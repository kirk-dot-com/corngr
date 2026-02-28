import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CaioProposal, CreateTxRequest, ApiResponse } from '../types';

const PROPOSAL_ICONS: Record<string, string> = {
    reorder_proposal: '📦',
    draft_invoice: '🧾',
    anomaly_flag: '⚠️',
    briefing: '🌅',
};

// ── Types from the Rust erp_caio_query response ──────────────────────────────

interface LlmProposal {
    id: string;
    type: string;
    title: string;
    rationale: string;
    source_fragment: string;
    source?: 'llm' | 'rules';
}

interface CaioQueryResult {
    proposals: LlmProposal[];
    used_llm: boolean;
    source_label: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function llmToProposal(p: LlmProposal): CaioProposal {
    return {
        id: p.id,
        type: p.type as CaioProposal['type'],
        title: p.title,
        rationale: p.rationale,
        source_fragment: p.source_fragment,
    };
}

// ── Component ────────────────────────────────────────────────────────────────

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
    const [query, setQuery] = useState('');
    const [llmProposals, setLlmProposals] = useState<LlmProposal[] | null>(null);
    const [sourceLabel, setSourceLabel] = useState<string | null>(null);
    const [usedLlm, setUsedLlm] = useState(false);
    const [querying, setQuerying] = useState(false);
    const [queryError, setQueryError] = useState<string | null>(null);

    const handleQuery = async () => {
        if (!query.trim()) return;
        setQuerying(true);
        setQueryError(null);
        setLlmProposals(null);
        try {
            const res = await invoke<ApiResponse<CaioQueryResult>>('erp_caio_query', {
                orgId: 'org_default',
                userQuery: query.trim(),
            });
            if (res.ok && res.data) {
                setLlmProposals(res.data.proposals);
                setUsedLlm(res.data.used_llm);
                setSourceLabel(res.data.source_label);
            } else {
                setQueryError((res as any).error ?? 'CAIO query failed');
            }
        } catch (e: any) {
            setQueryError(String(e));
        } finally {
            setQuerying(false);
        }
    };

    const displayProposals = llmProposals !== null
        ? llmProposals.map(llmToProposal)
        : proposals;

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

                {/* LLM Query Box */}
                <div className="caio-section-label" style={{ marginTop: 16 }}>
                    🤖 Ask CAIO
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQuery()}
                        placeholder="e.g. What should I do next?"
                        style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 8,
                            color: '#e5e7eb',
                            padding: '7px 10px',
                            fontSize: '0.75rem',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleQuery}
                        disabled={querying || !query.trim()}
                        className="erp-btn"
                        style={{ padding: '7px 12px', fontSize: '0.72rem', flexShrink: 0 }}
                    >
                        {querying ? '…' : 'Ask'}
                    </button>
                </div>
                {queryError && (
                    <div style={{ fontSize: '0.7rem', color: '#f87171', marginBottom: 8 }}>
                        ⚠️ {queryError}
                    </div>
                )}
                {sourceLabel && (
                    <div style={{
                        fontSize: '0.66rem', color: usedLlm ? '#34d399' : '#9ca3af',
                        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        {usedLlm ? '🟢' : '⚪'} {sourceLabel}
                        {llmProposals !== null && (
                            <button
                                onClick={() => { setLlmProposals(null); setSourceLabel(null); setQuery(''); }}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.68rem' }}
                            >
                                ✕ clear
                            </button>
                        )}
                    </div>
                )}

                {/* Proposals */}
                <div className="caio-section-label">
                    💡 Proposals
                    {displayProposals.length > 0 && (
                        <span style={{
                            marginLeft: 6, background: 'rgba(245,158,11,0.25)',
                            color: '#fbbf24', borderRadius: 10, padding: '0 7px',
                            fontSize: '0.62rem', fontWeight: 700,
                        }}>
                            {displayProposals.length}
                        </span>
                    )}
                </div>

                {displayProposals.length === 0 ? (
                    <div style={{
                        color: 'rgba(156,163,175,0.6)', fontSize: '0.76rem',
                        padding: '12px 0', textAlign: 'center'
                    }}>
                        No proposals — ledger looks healthy ✓
                    </div>
                ) : (
                    displayProposals.map(p => (
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

                {/* Phase B badge */}
                <div style={{
                    marginTop: 20, padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.68rem', color: 'rgba(156,163,175,0.6)', lineHeight: 1.5,
                }}>
                    <strong style={{ color: 'rgba(52,211,153,0.7)' }}>Phase B</strong> — CAIO
                    uses local Ollama LLM (Mistral) when available, falling back to deterministic
                    rules. All proposals are advisory; no direct mutations.
                </div>
            </div>
        </aside>
    );
};
