import React, { useState, useMemo } from 'react';
import type { TxSnapshot, TxStatus, TxType } from '../types';

const TX_ICONS: Partial<Record<TxType, string>> = {
    invoice_out: '🧾', invoice_in: '📥',
    payment_in: '💰', payment_out: '💸',
    stock_receipt: '📦', stock_issue: '🚚', stock_adjust: '⚖️',
    journal: '📓', credit_note: '🔵', debit_note: '🔴',
};

interface TxGridLensProps {
    transactions: TxSnapshot[];
    onSelectTx: (tx: TxSnapshot) => void;
}

type SortKey = keyof TxSnapshot;

export const TxGridLens: React.FC<TxGridLensProps> = ({ transactions, onSelectTx }) => {
    const [sortKey, setSortKey] = useState<SortKey>('tx_type');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [filter, setFilter] = useState<TxStatus | 'all'>('all');

    const sorted = useMemo(() => {
        let rows = filter === 'all' ? transactions : transactions.filter(t => t.status === filter);
        rows = [...rows].sort((a, b) => {
            const av = String(a[sortKey] ?? '');
            const bv = String(b[sortKey] ?? '');
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        return rows;
    }, [transactions, sortKey, sortDir, filter]);

    const handleSort = (key: SortKey) => {
        if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const SortIcon = ({ k }: { k: SortKey }) =>
        sortKey === k ? <span style={{ opacity: 0.7 }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span> : null;

    return (
        <div className="tx-grid">
            {/* Filter row */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {(['all', 'draft', 'proposed', 'approved', 'posted', 'void'] as const).map(s => (
                    <button key={s}
                        onClick={() => setFilter(s)}
                        style={{
                            padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                            background: filter === s ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.05)',
                            color: filter === s ? '#a5b4fc' : '#6b7280',
                        }}>
                        {s}
                    </button>
                ))}
                <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.72rem', alignSelf: 'center' }}>
                    {sorted.length} records
                </span>
            </div>

            {/* Table */}
            <table>
                <thead>
                    <tr>
                        <th onClick={() => handleSort('tx_type')}>Type <SortIcon k="tx_type" /></th>
                        <th onClick={() => handleSort('tx_id')}>Tx ID <SortIcon k="tx_id" /></th>
                        <th onClick={() => handleSort('status')}>Status <SortIcon k="status" /></th>
                        <th onClick={() => handleSort('org_id')}>Org <SortIcon k="org_id" /></th>
                        <th onClick={() => handleSort('line_count')}>Lines <SortIcon k="line_count" /></th>
                        <th onClick={() => handleSort('move_count')}>Moves <SortIcon k="move_count" /></th>
                        <th onClick={() => handleSort('site_id')}>Site <SortIcon k="site_id" /></th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.length === 0 ? (
                        <tr>
                            <td colSpan={7}>
                                <div className="erp-empty-state" style={{ padding: '40px 0' }}>
                                    <span className="empty-icon">📋</span>
                                    <p>No transactions yet — create one via the ERP engine or accept a CAIO proposal.</p>
                                </div>
                            </td>
                        </tr>
                    ) : sorted.map(tx => (
                        <tr key={tx.tx_id} onClick={() => onSelectTx(tx)}>
                            <td>
                                <span className="tx-type-icon">{TX_ICONS[tx.tx_type] ?? '📄'}</span>
                                {' '}{tx.tx_type.replace(/_/g, ' ')}
                            </td>
                            <td style={{ fontFamily: 'monospace', color: '#818cf8', fontSize: '0.74rem' }}>
                                {tx.tx_id.slice(0, 8)}…
                            </td>
                            <td><span className={`status-badge ${tx.status}`}>{tx.status}</span></td>
                            <td style={{ color: '#9ca3af' }}>{tx.org_id}</td>
                            <td style={{ textAlign: 'center' }}>{tx.line_count}</td>
                            <td style={{ textAlign: 'center' }}>{tx.move_count}</td>
                            <td style={{ color: '#9ca3af' }}>{tx.site_id}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
