import React, { useMemo } from 'react';
import type { TxSnapshot } from '../types';

interface LiquidityWaveProps {
    transactions: TxSnapshot[];
}

/**
 * Liquidity Wave — SVG sparkline showing mock AR / AP / Bank balance bars.
 * Phase A: computed from transaction counts (no materialized balances yet).
 * Phase B: replaced with real account balance aggregates from postings_by_account.
 */
export const LiquidityWave: React.FC<LiquidityWaveProps> = ({ transactions }) => {
    const { arCount, apCount, bankBalance } = useMemo(() => {
        const ar = transactions.filter(t => t.tx_type === 'invoice_out' && t.status !== 'void').length;
        const ap = transactions.filter(t => t.tx_type === 'invoice_in' && t.status !== 'void').length;
        const bank = transactions.filter(t => t.tx_type === 'payment_in').length
            - transactions.filter(t => t.tx_type === 'payment_out').length;
        return { arCount: ar, apCount: ap, bankBalance: bank };
    }, [transactions]);

    // Build a simple 7-point sparkline from recent activity
    const points = useMemo(() => {
        const base = transactions.length;
        return [0, 1, 2, 3, 4, 5, 6].map(i => {
            const v = Math.max(0, base - i + Math.sin(i) * 2);
            return v;
        });
    }, [transactions]);

    const max = Math.max(...points, 1);
    const h = 50;
    const w = 200;

    const pathPoints = points
        .map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * h}`)
        .join(' ');

    const totalAmount = transactions.length * 999; // Phase A mock amount

    return (
        <div className="widget-card liquidity-wave">
            <div className="widget-label">💧 Liquidity Wave</div>
            <div className="widget-value" style={{ color: '#34d399' }}>
                ${totalAmount.toLocaleString()}
            </div>
            <div className="widget-sub">AR: {arCount} · AP: {apCount} · Net: {bankBalance >= 0 ? '+' : ''}{bankBalance}</div>
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="liquidity-svg"
                style={{ width: '100%', height: 44, marginTop: 8 }}>
                <defs>
                    <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polyline
                    points={pathPoints}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                <polygon
                    points={`0,${h} ${pathPoints} ${w},${h}`}
                    fill="url(#waveGrad)"
                />
            </svg>
        </div>
    );
};
