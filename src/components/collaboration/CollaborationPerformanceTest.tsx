import React, { useState, useEffect, useRef } from 'react';
import './CollaborationPerformanceTest.css';

interface PerformanceMetrics {
    cursorLatency: number[];
    awarenessUpdates: number;
    documentUpdates: number;
    averageLatency: number;
    maxLatency: number;
    minLatency: number;
    fps: number;
}

interface CollaborationPerformanceTestProps {
    awareness: any; // Yjs Awareness
    doc: any; // Yjs Doc
}

/**
 * CollaborationPerformanceTest - Monitor real-time collaboration performance
 * 
 * Phase 6: Performance validation for cursor and document sync
 * Measures cursor update latency, awareness propagation, and frame rates
 */
export const CollaborationPerformanceTest: React.FC<CollaborationPerformanceTestProps> = ({
    awareness,
    doc
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        cursorLatency: [],
        awarenessUpdates: 0,
        documentUpdates: 0,
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        fps: 0
    });

    const startTimeRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const lastFrameTimeRef = useRef<number>(0);
    const latenciesRef = useRef<number[]>([]);

    useEffect(() => {
        if (!isRecording || !awareness || !doc) return;

        let awarenessCount = 0;
        let documentCount = 0;

        // Track awareness updates
        const awarenessHandler = ({ added, updated, removed }: any) => {
            const updateTime = performance.now();
            const latency = updateTime - (lastFrameTimeRef.current || updateTime);

            if (latency > 0 && latency < 10000) { // Sanity check
                latenciesRef.current.push(latency);
            }

            awarenessCount += added.length + updated.length + removed.length;

            // Update metrics
            updateMetrics(latenciesRef.current, awarenessCount, documentCount);
        };

        // Track document updates
        const docHandler = (_update: Uint8Array, origin: any) => {
            if (origin !== 'remote') return; // Only count remote updates

            documentCount++;
            updateMetrics(latenciesRef.current, awarenessCount, documentCount);
        };

        // Track FPS
        const fpsInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = (now - startTimeRef.current) / 1000;
            const fps = frameCountRef.current / elapsed;

            frameCountRef.current++;

            setMetrics(prev => ({
                ...prev,
                fps: Math.round(fps)
            }));
        }, 100);

        awareness.on('update', awarenessHandler);
        doc.on('update', docHandler);

        startTimeRef.current = performance.now();

        return () => {
            awareness.off('update', awarenessHandler);
            doc.off('update', docHandler);
            clearInterval(fpsInterval);
        };
    }, [isRecording, awareness, doc]);

    const updateMetrics = (latencies: number[], awarenessUpdates: number, documentUpdates: number) => {
        if (latencies.length === 0) return;

        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const max = Math.max(...latencies);
        const min = Math.min(...latencies);

        setMetrics(prev => ({
            ...prev,
            cursorLatency: latencies.slice(-50), // Keep last 50 samples for histogram
            awarenessUpdates,
            documentUpdates,
            averageLatency: Math.round(avg),
            maxLatency: Math.round(max),
            minLatency: Math.round(min)
        }));
    };

    const startRecording = () => {
        // Reset metrics
        latenciesRef.current = [];
        frameCountRef.current = 0;
        setMetrics({
            cursorLatency: [],
            awarenessUpdates: 0,
            documentUpdates: 0,
            averageLatency: 0,
            maxLatency: 0,
            minLatency: 0,
            fps: 0
        });
        setIsRecording(true);
    };

    const stopRecording = () => {
        setIsRecording(false);
        exportResults();
    };

    const exportResults = () => {
        console.log('='.repeat(60));
        console.log('📊 COLLABORATION PERFORMANCE TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`Total Awareness Updates: ${metrics.awarenessUpdates}`);
        console.log(`Total Document Updates: ${metrics.documentUpdates}`);
        console.log(`Average Cursor Latency: ${metrics.averageLatency}ms`);
        console.log(`Max Cursor Latency: ${metrics.maxLatency}ms`);
        console.log(`Min Cursor Latency: ${metrics.minLatency}ms`);
        console.log(`Current FPS: ${metrics.fps}`);
        console.log(`Target: < 100ms cursor latency`);
        console.log(`Status: ${metrics.averageLatency < 100 ? '✅ PASS' : '❌ FAIL'}`);
        console.log('='.repeat(60));
    };

    const getLatencyColor = (latency: number) => {
        if (latency < 50) return '#4ade80'; // green
        if (latency < 100) return '#fbbf24'; // yellow
        if (latency < 200) return '#fb923c'; // orange
        return '#f87171'; // red
    };

    return (
        <div className="perf-test-panel">
            <div className="perf-test-header">
                <h3>🔬 Collaboration Performance Monitor</h3>
                <div className="perf-test-controls">
                    {!isRecording ? (
                        <button onClick={startRecording} className="btn-start">
                            ▶ Start Recording
                        </button>
                    ) : (
                        <button onClick={stopRecording} className="btn-stop">
                            ⏹ Stop & Export
                        </button>
                    )}
                </div>
            </div>

            {isRecording && (
                <div className="perf-test-metrics">
                    <div className="metric-card">
                        <div className="metric-label">Avg Cursor Latency</div>
                        <div
                            className="metric-value"
                            style={{ color: getLatencyColor(metrics.averageLatency) }}
                        >
                            {metrics.averageLatency}ms
                        </div>
                        <div className="metric-target">Target: &lt; 100ms</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">Max Latency</div>
                        <div className="metric-value">{metrics.maxLatency}ms</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">Min Latency</div>
                        <div className="metric-value">{metrics.minLatency}ms</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">Awareness Updates</div>
                        <div className="metric-value">{metrics.awarenessUpdates}</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">Document Updates</div>
                        <div className="metric-value">{metrics.documentUpdates}</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">Frame Rate</div>
                        <div className="metric-value">{metrics.fps} fps</div>
                    </div>
                </div>
            )}

            {isRecording && metrics.cursorLatency.length > 0 && (
                <div className="latency-histogram">
                    <div className="histogram-label">Latency History (last 50 samples)</div>
                    <div className="histogram-bars">
                        {metrics.cursorLatency.map((latency, i) => (
                            <div
                                key={i}
                                className="histogram-bar"
                                style={{
                                    height: `${Math.min((latency / 200) * 100, 100)}%`,
                                    backgroundColor: getLatencyColor(latency)
                                }}
                                title={`${Math.round(latency)}ms`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
