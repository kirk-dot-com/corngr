import React, { useState, useCallback } from 'react';
import { useErpStore } from './store/useErpStore';
import { LiquidityWave } from './widgets/LiquidityWave';
import { GridHealthMap } from './widgets/GridHealthMap';
import { ProposalsFeed } from './widgets/ProposalsFeed';
import { AuditBadge } from './widgets/AuditBadge';
import { TxGridLens } from './lenses/TxGridLens';
import { TxKanbanLens } from './lenses/TxKanbanLens';
import { DrillPanel } from './DrillPanel';
import { CAIOSidebar } from './caio/CAIOSidebar';
import { AuditExplorer } from './audit/AuditExplorer';
import { PostingsLedger } from './ledger/PostingsLedger';
import type { TxSnapshot, CreateTxRequest } from './types';
import './erp.css';

type LensMode = 'grid' | 'kanban';

export const CockpitDashboard: React.FC = () => {
    const store = useErpStore();
    const [lensMode, setLensMode] = useState<LensMode>('grid');
    const [selectedTx, setSelectedTx] = useState<TxSnapshot | null>(null);
    const [cmdBarValue, setCmdBarValue] = useState('');
    const [showAuditExplorer, setShowAuditExplorer] = useState(false);
    const [showLedger, setShowLedger] = useState(false);

    const handleAcceptProposal = useCallback(async (payload: Partial<CreateTxRequest>) => {
        if (!payload.tx_type) return;
        await store.createTx({
            tx_type: payload.tx_type,
            org_id: payload.org_id ?? 'org_default',
            currency: payload.currency ?? 'AUD',
            tx_date: payload.tx_date ?? new Date().toISOString().slice(0, 10),
            description: payload.description ?? 'Created from CAIO proposal',
            site_id: payload.site_id ?? 'primary',
        });
    }, [store]);

    const handleCmdBarSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = cmdBarValue.trim().toLowerCase();
        if (!q) return;
        // Phase A DSL: keyword routing only (no LLM)
        if (q.includes('kanban') || q.includes('workflow') || q.includes('board')) setLensMode('kanban');
        else if (q.includes('grid') || q.includes('list') || q.includes('table')) setLensMode('grid');
        setCmdBarValue('');
    };

    return (
        <div className="erp-cockpit" id="erp-cockpit">
            {/* ── Main Area ── */}
            <div className="erp-main">
                {/* Header */}
                <header className="erp-header">
                    <div className="erp-header-title">
                        <span className="erp-logo-badge">🏭</span>
                        <h1>ERP Cockpit</h1>
                        {store.loading && (
                            <span style={{ fontSize: '0.72rem', color: '#667eea', marginLeft: 8 }}>syncing…</span>
                        )}
                        {store.error && (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', marginLeft: 8 }}>
                                ⚠ {store.error}
                            </span>
                        )}
                    </div>
                    <div className="erp-header-controls">
                        {/* Gen-UI Command Bar (§3.5) */}
                        <form className="erp-command-bar" onSubmit={handleCmdBarSubmit} id="erp-cmd-bar">
                            <span className="cmd-icon">✦</span>
                            <input
                                type="text"
                                id="erp-cmd-input"
                                placeholder="Ask CAIO… e.g. 'show kanban'"
                                value={cmdBarValue}
                                onChange={e => setCmdBarValue(e.target.value)}
                            />
                        </form>
                        <button
                            className="erp-btn"
                            id="ledger-btn"
                            onClick={() => setShowLedger(true)}
                        >
                            📒 Ledger
                        </button>
                        <button
                            className="erp-btn"
                            id="audit-explorer-btn"
                            onClick={() => setShowAuditExplorer(true)}
                        >
                            🔍 Audit
                        </button>
                        <button
                            className="erp-btn"
                            id="erp-refresh-btn"
                            onClick={store.refreshAll}
                            title="Refresh ERP data"
                        >
                            ↻ Refresh
                        </button>
                    </div>
                </header>

                {/* Widget Row */}
                <div className="erp-widgets" id="erp-widgets">
                    <LiquidityWave transactions={store.transactions} />
                    <GridHealthMap transactions={store.transactions} />
                    <ProposalsFeed proposals={store.proposals} onDismiss={store.dismissProposal} />
                    <AuditBadge intact={store.auditChainIntact} />
                </div>

                {/* Lens Toggle */}
                <div className="lens-toggle-bar">
                    <button
                        id="lens-grid-btn"
                        className={`lens-btn ${lensMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setLensMode('grid')}
                    >
                        ▤ Grid Lens
                    </button>
                    <button
                        id="lens-kanban-btn"
                        className={`lens-btn ${lensMode === 'kanban' ? 'active' : ''}`}
                        onClick={() => setLensMode('kanban')}
                    >
                        ▦ Kanban Lens
                    </button>
                    <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.72rem' }}>
                        {store.transactions.length} transaction{store.transactions.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Lens Area */}
                <div className="erp-lens-area" id="erp-lens-area">
                    {lensMode === 'grid' ? (
                        <TxGridLens transactions={store.transactions} onSelectTx={setSelectedTx} />
                    ) : (
                        <TxKanbanLens transactions={store.transactions} onSelectTx={setSelectedTx} />
                    )}
                </div>
            </div>

            {/* ── CAIO Sidebar ── */}
            <CAIOSidebar
                proposals={store.proposals}
                briefingBullets={store.briefingBullets}
                onAccept={handleAcceptProposal}
                onDismiss={store.dismissProposal}
            />

            {/* ── Drill Panel (modal) ── */}
            {selectedTx && (
                <DrillPanel tx={selectedTx} onClose={() => setSelectedTx(null)} />
            )}

            {/* ── Audit Explorer (M4) ── */}
            {showAuditExplorer && (
                <AuditExplorer onClose={() => setShowAuditExplorer(false)} />
            )}

            {/* ── Postings Ledger (M5) ── */}
            {showLedger && (
                <PostingsLedger onClose={() => setShowLedger(false)} />
            )}
        </div>
    );
};
