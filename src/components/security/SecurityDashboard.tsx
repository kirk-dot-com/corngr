import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MetadataStore, VerificationStatus } from '../../metadata/MetadataStore';
import { AuditEvent } from '../../security/types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import './SecurityDashboard.css';

interface SecurityDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    metadataStore: MetadataStore | null;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ isOpen, onClose, metadataStore }) => {
    const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
    const [stats, setStats] = useState<Record<VerificationStatus, number>>({
        verified: 0, tampered: 0, unsigned: 0, unknown: 0, verifying: 0
    });

    useEffect(() => {
        if (!isOpen) return;

        // Fetch logs
        invoke<AuditEvent[]>('get_audit_log', { limit: 50 })
            .then(logs => setAuditLogs(logs))
            .catch(err => console.error("Failed to fetch audit logs:", err));

        // Update stats
        if (metadataStore) {
            setStats(metadataStore.getVerificationStats());

            // Subscribe to updates in case verification is running
            const handler = () => {
                setStats(metadataStore.getVerificationStats());
            };
            metadataStore.on('verification', handler);
            return () => metadataStore.off('verification', handler);
        }
    }, [isOpen, metadataStore]);

    if (!isOpen) return null;

    // Filter data for chart (hide zero values)
    const data = [
        { name: 'Verified', value: stats.verified, color: '#4cd964' },
        { name: 'Tampered', value: stats.tampered, color: '#f44336' },
        { name: 'Unsigned', value: stats.unsigned, color: 'rgba(255,255,255,0.2)' },
        { name: 'Verifying', value: stats.verifying, color: '#ffc107' }
    ].filter(d => d.value > 0);

    // If no data (empty document), show placeholder
    if (data.length === 0) {
        data.push({ name: 'Empty', value: 1, color: 'rgba(255,255,255,0.1)' });
    }

    return (
        <div className="security-dashboard-overlay">
            <div className="security-dashboard-container">
                <div className="dashboard-header">
                    <h2>🛡️ Security & Compliance Dashboard</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="dashboard-content">
                    <div className="stats-panel">
                        <h3>Document Integrity</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={data}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="stats-list">
                            <div className="stat-item verified">
                                <span className="dot" style={{ background: '#4cd964' }}></span>
                                Verified Blocks: <strong>{stats.verified}</strong>
                            </div>
                            <div className="stat-item tampered">
                                <span className="dot" style={{ background: '#f44336' }}></span>
                                Tampered Blocks: <strong>{stats.tampered}</strong>
                            </div>
                            <div className="stat-item unsigned">
                                <span className="dot" style={{ background: 'rgba(255,255,255,0.2)' }}></span>
                                Unsigned Blocks: <strong>{stats.unsigned}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="logs-panel">
                        <h3>Audit Log (Last 50 Events)</h3>
                        <div className="logs-table-wrapper">
                            <table className="logs-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Sev</th>
                                        <th>Action</th>
                                        <th>User</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="empty-logs">No audit logs found.</td></tr>
                                    ) : (
                                        auditLogs.map((log, i) => (
                                            <tr key={i} className={`log-row severity-${log.severity.toLowerCase()}`}>
                                                <td className="col-time">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                                <td className="col-sev"><span className={`badge severity-${log.severity.toLowerCase()}`}>{log.severity}</span></td>
                                                <td className="col-action">{log.action}</td>
                                                <td className="col-user">{log.user_id}</td>
                                                <td className="col-details" title={log.details}>{log.details}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
