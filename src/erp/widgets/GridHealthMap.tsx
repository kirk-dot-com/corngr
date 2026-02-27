import React from 'react';
import type { TxSnapshot } from '../types';

interface GridHealthMapProps {
    transactions: TxSnapshot[];
}

export const GridHealthMap: React.FC<GridHealthMapProps> = ({ transactions }) => {
    const outbox = transactions.filter(t => t.status === 'draft' || t.status === 'proposed').length;
    const lastSyncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const health = outbox === 0 ? 'Clean' : outbox < 5 ? 'Pending' : 'Backlog';
    const healthColor = outbox === 0 ? '#34d399' : outbox < 5 ? '#fbbf24' : '#f87171';

    return (
        <div className="widget-card">
            <div className="widget-label">🌐 Grid Health</div>
            <div className="widget-value" style={{ color: healthColor, fontSize: '1.3rem' }}>
                {health}
            </div>
            <div className="widget-sub" style={{ marginTop: 6 }}>
                <span style={{ color: '#9ca3af' }}>Mode: </span>
                <span style={{ color: '#60a5fa' }}>Local ●</span>
            </div>
            <div className="widget-sub">Outbox: {outbox} · Sync: {lastSyncTime}</div>
        </div>
    );
};
