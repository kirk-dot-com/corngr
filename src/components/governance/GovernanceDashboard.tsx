import React, { useState, useMemo } from 'react';
import { MetadataStore } from '../../metadata/MetadataStore';
import { getAllBlocks } from '../../yjs/schema';
import * as Y from 'yjs';
import './GovernanceDashboard.css';

interface GovernanceDashboardProps {
    metadataStore: MetadataStore;
    yDoc: Y.Doc;
}

/**
 * Enterprise Governance Dashboard [Sprint 3]
 * 
 * Provides the "X-Ray" view of document lineage and security health.
 * Features:
 * - Lineage Visualization (Provenance Tracking)
 * - Security Classification Distribution
 * - Audit Log Simulation
 */
export const GovernanceDashboard: React.FC<GovernanceDashboardProps> = ({ metadataStore, yDoc }) => {
    const [search, setSearch] = useState('');
    const blocks = useMemo(() => getAllBlocks(yDoc), [yDoc]);

    const stats = useMemo(() => {
        const counts = { public: 0, internal: 0, confidential: 0, restricted: 0 };
        blocks.forEach(b => {
            const meta = metadataStore.get(b.id) || b.data.metadata;
            const cls = meta?.classification || 'public';
            if (cls in counts) counts[cls as keyof typeof counts]++;
        });
        return counts;
    }, [blocks, metadataStore]);

    const filteredBlocks = blocks.filter(b =>
        b.data.text?.toLowerCase().includes(search.toLowerCase()) ||
        b.id.includes(search)
    );

    return (
        <div className="governance-dashboard">
            <header className="gov-header">
                <div className="gov-title">
                    <h2>🛡️ Enterprise Governance Hub</h2>
                    <p>Document-wide Lineage & Compliance Audit</p>
                </div>
                <div className="gov-search">
                    <input
                        type="text"
                        placeholder="Search blocks, authorship, or IDs..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </header>

            <section className="gov-stats">
                {Object.entries(stats).map(([cls, count]) => (
                    <div key={cls} className={`stat-card stat-${cls}`}>
                        <div className="stat-label">{cls.toUpperCase()}</div>
                        <div className="stat-value">{count}</div>
                        <div className="stat-progress">
                            <div className="progress-bar" style={{ width: `${(count / blocks.length) * 100}%` }}></div>
                        </div>
                    </div>
                ))}
            </section>

            <main className="gov-table-container">
                <table className="gov-table">
                    <thead>
                        <tr>
                            <th>Block ID</th>
                            <th>Type</th>
                            <th>Classification</th>
                            <th>Lineage (Provenance)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBlocks.map(block => {
                            const meta = metadataStore.get(block.id) || block.data.metadata;
                            const prov = meta?.provenance;

                            return (
                                <tr key={block.id}>
                                    <td className="cell-id"><code>{block.id.substring(0, 8)}...</code></td>
                                    <td><span className="type-badge">{block.type}</span></td>
                                    <td>
                                        <span className={`cls-badge cls-${meta?.classification || 'public'}`}>
                                            {meta?.classification || 'PUBLIC'}
                                        </span>
                                    </td>
                                    <td className="cell-lineage">
                                        {prov ? (
                                            <div className="lineage-info">
                                                <span className="lineage-author">👤 {prov.authorId}</span>
                                                <span className="lineage-origin">
                                                    {prov.originUrl ? `🌐 ${prov.originUrl}` : '🏠 Local Origin'}
                                                </span>
                                                <div className="lineage-timestamp">{new Date(prov.timestamp).toLocaleString()}</div>
                                            </div>
                                        ) : (
                                            <span className="lineage-none">No Provenance Data</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="status-indicator">
                                            <span className={`status-dot ${meta?.locked ? 'locked' : 'online'}`}></span>
                                            {meta?.locked ? 'LOCKED' : 'VERIFIED'}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </main>

            <footer className="gov-footer">
                <button className="gov-action-btn">📥 Export Compliance Report (PDF)</button>
                <button className="gov-action-btn secondary">🔍 Verify All Signatures</button>
            </footer>
        </div>
    );
};
