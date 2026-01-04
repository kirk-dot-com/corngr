import React from 'react';
import './HelpPanel.css';

interface HelpPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="help-panel-overlay">
            <div className="help-panel-container">
                <div className="help-panel-header">
                    <div className="help-panel-title">
                        <span className="help-icon">🌽</span>
                        <h2>Corngr User Guide</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="help-close-button"
                        aria-label="Close help panel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="help-panel-content">
                    <div className="help-tip">
                        <strong>Pro Tip:</strong> This panel stays open while you work! Use it to reference shortcuts and features in real-time.
                    </div>

                    <section className="help-section">
                        <h3><span className="section-number">01</span> Zero-Trust Security</h3>
                        <p>
                            Every document is verified cryptographically on your local machine. Corngr uses a <strong>local-first architecture</strong> where you hold the keys.
                        </p>
                        <ul>
                            <li><strong>Tamper-Proof:</strong> Ed25519 signatures validate every single block change.</li>
                            <li><strong>Total Ownership:</strong> Your data never leaves your device unencrypted.</li>
                        </ul>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">02</span> Live Transclusion</h3>
                        <p>
                            Don't copy-paste data. Use <strong>Inline References</strong> to embed live blocks from other documents.
                        </p>
                        <div className="help-code-block">
                            <p className="code-label">How it works:</p>
                            <p className="code-text">
                                When you change the source document, every transcluded reference updates instantly across all users and devices.
                            </p>
                        </div>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">03</span> Capability Tokens</h3>
                        <p>
                            High-security usually means high-latency. Corngr solves this with <strong>Capability Tokens</strong>.
                        </p>
                        <div className="help-grid">
                            <div className="help-stat-card standard">
                                <p className="stat-label">Standard Check</p>
                                <p className="stat-value slow">~120ms</p>
                            </div>
                            <div className="help-stat-card token">
                                <p className="stat-label">Token Check</p>
                                <p className="stat-value fast">~5ms</p>
                            </div>
                        </div>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">04</span> Dual-View Editing</h3>
                        <p>
                            Switch between 📝 <strong>Document</strong> and 📊 <strong>Slides</strong> view.
                        </p>
                        <ul>
                            <li><strong>Instant Conversion:</strong> No more PowerPoint exports.</li>
                            <li><strong>Yjs Powered:</strong> Real-time collaboration in both views.</li>
                        </ul>
                    </section>

                    <div className="help-note">
                        <h4>🌐 Browser Sync Note</h4>
                        <p>
                            In browser mode, Corngr uses cloud-only sync via Supabase. Local file system saving is disabled to protect your host OS.
                        </p>
                    </div>

                    <div className="help-footer-text">
                        Corngr Prototype v6.5 • Secure Data OS
                    </div>
                </div>
            </div>
        </div>
    );
};
