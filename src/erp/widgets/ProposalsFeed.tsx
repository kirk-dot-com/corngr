import React from 'react';
import type { CaioProposal } from '../types';

interface ProposalsFeedProps {
    proposals: CaioProposal[];
    onDismiss: (id: string) => void;
}

const PROPOSAL_ICONS: Record<string, string> = {
    reorder_proposal: '📦',
    draft_invoice: '🧾',
    anomaly_flag: '⚠️',
    briefing: '🌅',
};

export const ProposalsFeed: React.FC<ProposalsFeedProps> = ({ proposals, onDismiss }) => {
    return (
        <div className="widget-card" style={{ gridColumn: 'span 1' }}>
            <div className="widget-label">🤖 AI Proposals</div>
            <div className="widget-value" style={{ fontSize: '1.6rem' }}>
                {proposals.length}
            </div>
            <div className="widget-sub">
                {proposals.length === 0
                    ? 'No pending proposals'
                    : proposals.slice(0, 2).map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <span>{PROPOSAL_ICONS[p.type] ?? '💡'}</span>
                            <span style={{
                                fontSize: '0.72rem', color: '#e5e7eb', flex: 1,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {p.title}
                            </span>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};
