import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ApiResponse } from '../types';
import { CoAPicker } from './CoAPicker';

export interface AccountView {
    code: string;
    name: string;
    acct_type: string;
    normal_balance: string;
}

export interface LedgerAccountRow {
    account_id: string;
    account_name: string;
    acct_type: string;
    normal_balance: string;
    total_debit: number;
    total_credit: number;
    balance: number;
    tx_count: number;
}

interface PostingsLedgerProps {
    onClose: () => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    asset: { label: 'Assets', color: '#60a5fa' },
    liability: { label: 'Liabilities', color: '#f87171' },
    equity: { label: 'Equity', color: '#a78bfa' },
    income: { label: 'Income', color: '#34d399' },
    expense: { label: 'Expenses', color: '#fbbf24' },
    unknown: { label: 'Other', color: '#9ca3af' },
};

const DEMO_ROWS: LedgerAccountRow[] = [
    { account_id: 'accounts_receivable', account_name: 'Accounts Receivable', acct_type: 'asset', normal_balance: 'debit', total_debit: 11000, total_credit: 0, balance: 11000, tx_count: 2 },
    { account_id: 'revenue', account_name: 'Revenue', acct_type: 'income', normal_balance: 'credit', total_debit: 0, total_credit: 10000, balance: 10000, tx_count: 2 },
    { account_id: 'tax_payable', account_name: 'GST Tax Payable', acct_type: 'liability', normal_balance: 'credit', total_debit: 0, total_credit: 1000, balance: 1000, tx_count: 2 },
];

const DEMO_ACCOUNTS: AccountView[] = [
    { code: '1000', name: 'Cash & Bank', acct_type: 'asset', normal_balance: 'debit' },
    { code: '1100', name: 'Accounts Receivable', acct_type: 'asset', normal_balance: 'debit' },
    { code: '1200', name: 'GST Input Tax Credit', acct_type: 'asset', normal_balance: 'debit' },
    { code: '2000', name: 'Accounts Payable', acct_type: 'liability', normal_balance: 'credit' },
    { code: '2100', name: 'GST Tax Payable', acct_type: 'liability', normal_balance: 'credit' },
    { code: '3000', name: "Owner's Equity", acct_type: 'equity', normal_balance: 'credit' },
    { code: '4000', name: 'Revenue', acct_type: 'income', normal_balance: 'credit' },
    { code: '5000', name: 'Cost of Goods Sold', acct_type: 'expense', normal_balance: 'debit' },
];

export const PostingsLedger: React.FC<PostingsLedgerProps> = ({ onClose }) => {
    const [accounts, setAccounts] = useState<AccountView[]>([]);
    const [rows, setRows] = useState<LedgerAccountRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEmpty, setIsEmpty] = useState(false);
    const [selectedAcct, setSelectedAcct] = useState<string | null>(null);
    const [seededCount, setSeededCount] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [coaRes, ledgerRes] = await Promise.all([
                invoke<ApiResponse<AccountView[]>>('erp_list_coa'),
                invoke<ApiResponse<LedgerAccountRow[]>>('erp_get_ledger_summary'),
            ]);
            const accts = coaRes.ok && coaRes.data ? coaRes.data : [];
            setAccounts(accts);
            setIsEmpty(accts.length === 0);
            if (ledgerRes.ok && ledgerRes.data) setRows(ledgerRes.data);
        } catch {
            // Browser fallback
            if (seededCount > 0) {
                setAccounts(DEMO_ACCOUNTS);
                setRows(DEMO_ROWS);
                setIsEmpty(false);
            } else {
                setIsEmpty(true);
            }
        } finally {
            setLoading(false);
        }
    }, [seededCount]);

    useEffect(() => {
        load();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [load, onClose]);

    const handleSeeded = (count: number) => {
        setSeededCount(count);
        setIsEmpty(false);
        setAccounts(DEMO_ACCOUNTS);
        setRows(DEMO_ROWS);
    };

    // Group accounts by type
    const grouped = accounts.reduce<Record<string, AccountView[]>>((acc, a) => {
        (acc[a.acct_type] ||= []).push(a);
        return acc;
    }, {});

    // Selected account's posting rows
    const selectedRows = selectedAcct
        ? rows.filter(r => r.account_id === selectedAcct || r.account_name === selectedAcct)
        : [];

    // Totals
    const totalDR = rows.reduce((s, r) => s + r.total_debit, 0);
    const totalCR = rows.reduce((s, r) => s + r.total_credit, 0);
    const imbalance = Math.abs(totalDR - totalCR) > 0.01;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 200, backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'stretch',
        }}>
            <div style={{
                marginLeft: 'auto', width: 820, maxWidth: '96vw',
                background: '#0b0b18', height: '100%',
                borderLeft: '1px solid rgba(255,255,255,0.09)',
                display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s ease',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
                }}>
                    <div>
                        <div style={{
                            fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 800,
                            background: 'linear-gradient(135deg, #fff, #a78bfa)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                        }}>
                            📒 Postings Ledger
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
                            {accounts.length} accounts · {rows.length} active balances
                        </div>
                    </div>
                    <button onClick={onClose} className="drill-close">✕</button>
                </div>

                {/* Content */}
                {loading ? (
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#6b7280', fontSize: '0.85rem'
                    }}>Loading ledger…</div>
                ) : isEmpty ? (
                    <CoAPicker onSeeded={handleSeeded} />
                ) : (
                    <>
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* Left: CoA account list */}
                            <div style={{
                                width: 240, borderRight: '1px solid rgba(255,255,255,0.07)',
                                overflowY: 'auto', flexShrink: 0, padding: '10px 0',
                            }}>
                                {Object.entries(grouped).sort(([a], [b]) => {
                                    const ord = ['asset', 'liability', 'equity', 'income', 'expense'];
                                    return ord.indexOf(a) - ord.indexOf(b);
                                }).map(([type, accts]) => {
                                    const info = TYPE_LABELS[type] ?? TYPE_LABELS.unknown;
                                    return (
                                        <div key={type}>
                                            <div style={{
                                                padding: '6px 16px 4px', fontSize: '0.62rem', fontWeight: 700,
                                                letterSpacing: '0.9px', textTransform: 'uppercase',
                                                color: info.color, opacity: 0.8
                                            }}>
                                                {info.label}
                                            </div>
                                            {accts.map(a => {
                                                const row = rows.find(r => r.account_id === a.code || r.account_name === a.name);
                                                const isSelected = selectedAcct === a.name;
                                                return (
                                                    <div key={a.code}
                                                        onClick={() => setSelectedAcct(isSelected ? null : a.name)}
                                                        style={{
                                                            padding: '7px 16px', cursor: 'pointer', display: 'flex',
                                                            justifyContent: 'space-between', alignItems: 'center',
                                                            background: isSelected ? 'rgba(167,139,250,0.12)' : undefined,
                                                            borderLeft: isSelected ? '3px solid #a78bfa' : '3px solid transparent',
                                                        }}
                                                    >
                                                        <div>
                                                            <span style={{
                                                                fontSize: '0.68rem', color: '#6b7280', fontFamily: 'monospace',
                                                                marginRight: 6
                                                            }}>{a.code}</span>
                                                            <span style={{ fontSize: '0.76rem', color: '#d1d5db' }}>{a.name}</span>
                                                        </div>
                                                        {row && (
                                                            <span style={{
                                                                fontSize: '0.7rem', color: info.color, fontWeight: 700,
                                                                fontFamily: 'Outfit, sans-serif'
                                                            }}>
                                                                {row.balance >= 0 ? '' : '−'}${Math.abs(row.balance).toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Right: posting detail or full summary */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
                                {selectedAcct && selectedRows.length > 0 ? (
                                    <div style={{ padding: '16px 20px' }}>
                                        <div style={{
                                            fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1,
                                            textTransform: 'uppercase', color: '#6b7280', marginBottom: 12
                                        }}>
                                            {selectedAcct}
                                        </div>
                                        {selectedRows.map(r => (
                                            <div key={r.account_id} style={{
                                                background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                                                padding: '14px 16px', marginBottom: 8,
                                            }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                                    {[
                                                        ['Debit', `$${r.total_debit.toFixed(2)}`, '#60a5fa'],
                                                        ['Credit', `$${r.total_credit.toFixed(2)}`, '#f87171'],
                                                        ['Balance', `$${r.balance.toFixed(2)}`, r.balance >= 0 ? '#34d399' : '#f87171'],
                                                    ].map(([k, v, c]) => (
                                                        <div key={String(k)}>
                                                            <div style={{
                                                                fontSize: '0.62rem', color: '#6b7280', textTransform: 'uppercase',
                                                                letterSpacing: '0.8px', marginBottom: 2
                                                            }}>{k}</div>
                                                            <div style={{
                                                                fontFamily: 'Outfit, sans-serif', fontSize: '1rem',
                                                                fontWeight: 800, color: String(c)
                                                            }}>{v}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#4b5563', marginTop: 8 }}>
                                                    {r.tx_count} posting{r.tx_count !== 1 ? 's' : ''} · {r.acct_type} · normal balance: {r.normal_balance}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <table className="drill-table" style={{ width: '100%' }}>
                                        <thead>
                                            <tr>
                                                <th>Account</th>
                                                <th>Type</th>
                                                <th>Debit</th>
                                                <th>Credit</th>
                                                <th>Balance</th>
                                                <th>Postings</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(r => {
                                                const info = TYPE_LABELS[r.acct_type] ?? TYPE_LABELS.unknown;
                                                return (
                                                    <tr key={r.account_id}
                                                        onClick={() => setSelectedAcct(r.account_name)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <td>
                                                            <div style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.8rem' }}>{r.account_name}</div>
                                                            <div style={{ fontSize: '0.65rem', color: '#6b7280', fontFamily: 'monospace' }}>{r.account_id}</div>
                                                        </td>
                                                        <td><span style={{ fontSize: '0.7rem', color: info.color, fontWeight: 700 }}>{info.label}</span></td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#60a5fa' }}>
                                                            {r.total_debit > 0 ? `$${r.total_debit.toFixed(2)}` : '—'}
                                                        </td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#f87171' }}>
                                                            {r.total_credit > 0 ? `$${r.total_credit.toFixed(2)}` : '—'}
                                                        </td>
                                                        <td style={{
                                                            fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem',
                                                            color: r.balance >= 0 ? '#34d399' : '#f87171'
                                                        }}>
                                                            ${Math.abs(r.balance).toFixed(2)}
                                                        </td>
                                                        <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.78rem' }}>{r.tx_count}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Footer: DR/CR totals + imbalance warning */}
                        <div style={{
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                            padding: '10px 22px', display: 'flex', alignItems: 'center',
                            gap: 24, flexShrink: 0,
                            background: imbalance ? 'rgba(239,68,68,0.06)' : undefined,
                        }}>
                            <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>Totals:</span>
                            <span style={{ fontSize: '0.82rem', color: '#60a5fa', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                                DR ${totalDR.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '0.82rem', color: '#f87171', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                                CR ${totalCR.toFixed(2)}
                            </span>
                            {imbalance ? (
                                <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>
                                    ⚠ Imbalance: ${Math.abs(totalDR - totalCR).toFixed(2)}
                                </span>
                            ) : rows.length > 0 ? (
                                <span style={{ fontSize: '0.78rem', color: '#34d399' }}>✓ Balanced</span>
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
