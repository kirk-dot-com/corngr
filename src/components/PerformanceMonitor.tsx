import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';

// Global metric store for Phase 0 simplicity
export const metrics = {
    lastUpdate: 0,
    lastRender: 0,
    latency: 0,
    listeners: new Set<() => void>()
};

export const recordUpdate = () => {
    metrics.lastUpdate = performance.now();
};

export const recordRender = () => {
    metrics.lastRender = performance.now();

    // Only calculate if we have a pending update timestamp that is recent (e.g. within last second)
    // to avoid measuring random re-renders as high latency relative to old updates
    if (metrics.lastUpdate > 0 && (metrics.lastRender - metrics.lastUpdate) < 1000) {
        metrics.latency = metrics.lastRender - metrics.lastUpdate;
        metrics.listeners.forEach(l => l());
    }
};

interface Props {
    yDoc: Y.Doc;
}

export const PerformanceMonitor: React.FC<Props> = ({ yDoc }) => {
    const [stats, setStats] = useState({ latency: 0 });
    const [maxLatency, setMaxLatency] = useState(0);

    useEffect(() => {
        // Listen to Yjs updates
        const onUpdate = () => {
            recordUpdate();
        };
        yDoc.on('update', onUpdate);

        // Listen for internal metric updates
        const onMetricChange = () => {
            setStats(_prev => {
                const newLatency = metrics.latency;
                if (newLatency > maxLatency) setMaxLatency(newLatency);
                return { latency: newLatency };
            });
        };
        metrics.listeners.add(onMetricChange);

        return () => {
            yDoc.off('update', onUpdate);
            metrics.listeners.delete(onMetricChange);
        };
    }, [yDoc, maxLatency]);

    // Reset max every 5 seconds to keep it relevant
    useEffect(() => {
        const interval = setInterval(() => setMaxLatency(0), 5000);
        return () => clearInterval(interval);
    }, []);

    const getColor = (ms: number) => {
        if (ms < 16) return '#0f0'; // 60fps
        if (ms < 50) return '#adff2f';
        if (ms < 100) return '#ffa500'; // Warning
        return '#f00'; // Danger
    };

    return (
        <div className="perf-monitor" style={{
            position: 'fixed', bottom: 10, right: 10,
            background: 'rgba(0,0,0,0.85)',
            borderLeft: `4px solid ${getColor(stats.latency)}`,
            color: '#fff',
            padding: '12px', fontSize: '12px', borderRadius: '4px',
            fontFamily: 'monospace', zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: '4px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #555', paddingBottom: '4px', marginBottom: '2px' }}>
                PERFORMANCE
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span>Latency:</span>
                <span style={{ color: getColor(stats.latency) }}>{stats.latency.toFixed(1)}ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', opacity: 0.7 }}>
                <span>Max (5s):</span>
                <span>{maxLatency.toFixed(1)}ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', opacity: 0.7 }}>
                <span>Target:</span>
                <span>&lt;100ms</span>
            </div>
        </div>
    );
};
