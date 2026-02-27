import React from 'react';
import type { TxSnapshot, TxStatus } from '../types';

const COLUMNS: { status: TxStatus; label: string; color: string }[] = [
    { status: 'draft', label: 'Draft', color: '#6b7280' },
    { status: 'proposed', label: 'Proposed', color: '#60a5fa' },
    { status: 'approved', label: 'Approved', color: '#fbbf24' },
    { status: 'posted', label: 'Posted', color: '#34d399' },
    { status: 'void', label: 'Void', color: '#f87171' },
];

const TX_ICONS: Record<string, string> = {
    invoice_out: '🧾', invoice_in: '📥',
    payment_in: '💰', payment_out: '💸',
    stock_receipt: '📦', stock_issue: '🚚', stock_adjust: '⚖️',
    journal: '📓', credit_note: '🔵', debit_note: '🔴',
};

interface TxKanbanLensProps {
    transactions: TxSnapshot[];
    onSelectTx: (tx: TxSnapshot) => void;
}

export const TxKanbanLens: React.FC<TxKanbanLensProps> = ({ transactions, onSelectTx }) => {
    return (
        <div className="tx-kanban">
            {COLUMNS.map(col => {
                const cards = transactions.filter(t => t.status === col.status);
                return (
                    <div key={col.status} className="kanban-column">
                        <div className="kanban-col-header" style={{ color: col.color }}>
                            <span>{col.label}</span>
                            <span className="kanban-count">{cards.length}</span>
                        </div>
                        {cards.map(tx => (
                            <div key={tx.tx_id} className="kanban-card" onClick={() => onSelectTx(tx)}>
                                <div className="kanban-card-type">
                                    {TX_ICONS[tx.tx_type] ?? '📄'} {tx.tx_type.replace(/_/g, ' ')}
                                </div>
                                <div className="kanban-card-id">{tx.tx_id.slice(0, 10)}…</div>
                                <div className="kanban-card-meta">
                                    {tx.line_count} line{tx.line_count !== 1 ? 's' : ''}
                                    {tx.move_count > 0 ? ` · ${tx.move_count} move${tx.move_count !== 1 ? 's' : ''}` : ''}
                                    {' · '}{tx.site_id}
                                </div>
                            </div>
                        ))}
                        {cards.length === 0 && (
                            <div style={{ color: '#374151', fontSize: '0.72rem', padding: '8px 6px', textAlign: 'center' }}>
                                Empty
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
