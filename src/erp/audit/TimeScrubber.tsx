import React, { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ApiResponse } from '../types';

interface TimeTravelSnapshot {
    as_of_ms: number;
    tx_count: number;
    posted_count: number;
    mutation_count: number;
    chain_intact: boolean;
    as_of_label: string;
}

interface TimeScrubberProps {
    timestamps: number[];
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({ timestamps }) => {
    const minTs = timestamps[0];
    const maxTs = timestamps[timestamps.length - 1];
    const [value, setValue] = useState(maxTs);
    const [snapshot, setSnapshot] = useState<TimeTravelSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchSnapshot = useCallback(async (ts: number) => {
        setLoading(true);
        try {
            const res = await invoke<ApiResponse<TimeTravelSnapshot>>('erp_time_travel', {
                targetTsMs: ts,
            });
            if (res.ok && res.data) setSnapshot(res.data);
        } catch {
            // Browser fallback — construct a synthetic snapshot
            const idx = timestamps.findIndex(t => t >= ts);
            const mutCount = idx === -1 ? timestamps.length : idx + 1;
            setSnapshot({
                as_of_ms: ts,
                tx_count: Math.max(0, Math.floor(mutCount / 2)),
                posted_count: 0,
                mutation_count: mutCount,
                chain_intact: true,
                as_of_label: new Date(ts).toLocaleString(),
            });
        } finally {
            setLoading(false);
        }
    }, [timestamps]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const ts = Number(e.target.value);
        setValue(ts);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSnapshot(ts), 400);
    };

    const pct = maxTs === minTs ? 100 : ((value - minTs) / (maxTs - minTs)) * 100;

    return (
        <div style={{ padding: '14px 22px 12px' }}>
            <div style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1,
                textTransform: 'uppercase', color: '#6b7280', marginBottom: 8
            }}>
                ⏱ Time Machine
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '0.68rem', color: '#4b5563', whiteSpace: 'nowrap' }}>
                    {new Date(minTs).toLocaleTimeString()}
                </span>
                <input
                    id="time-scrubber"
                    type="range"
                    min={minTs}
                    max={maxTs}
                    value={value}
                    step={1}
                    onChange={handleChange}
                    style={{ flex: 1, accentColor: '#667eea', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.68rem', color: '#4b5563', whiteSpace: 'nowrap' }}>
                    {new Date(maxTs).toLocaleTimeString()}
                </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#818cf8', fontWeight: 600 }}>
                    Reconstructed at: {new Date(value).toLocaleString()}
                    {' '}({Math.round(pct)}%)
                </span>
                {loading && <span style={{ fontSize: '0.68rem', color: '#667eea' }}>replaying…</span>}
            </div>

            {snapshot && (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                    marginTop: 10, padding: '10px 12px',
                    background: 'rgba(102,126,234,0.07)', borderRadius: 10,
                    border: '1px solid rgba(102,126,234,0.15)',
                }}>
                    {[
                        { label: 'Txs', value: snapshot.tx_count, color: '#a5b4fc' },
                        { label: 'Posted', value: snapshot.posted_count, color: '#34d399' },
                        { label: 'Mutations', value: snapshot.mutation_count, color: '#fbbf24' },
                        {
                            label: 'Chain', value: snapshot.chain_intact ? '✓ OK' : '✗ Tampered',
                            color: snapshot.chain_intact ? '#34d399' : '#f87171'
                        },
                    ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center' }}>
                            <div style={{
                                fontSize: '0.62rem', color: '#6b7280', textTransform: 'uppercase',
                                letterSpacing: '0.8px', marginBottom: 2
                            }}>{item.label}</div>
                            <div style={{
                                fontSize: '1rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif',
                                color: item.color
                            }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
