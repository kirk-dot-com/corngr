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
                        <strong>Pro Tip:</strong> This panel stays open while you work! Reference features and shortcuts in real-time. Ask the AI assistant (✨) if you need help with any feature.
                    </div>

                    <section className="help-section">
                        <h3><span className="section-number">01</span> Zero-Trust Security</h3>

                        <h4>What It Is</h4>
                        <p>
                            Zero-Trust means every document is cryptographically verified on your local machine. Corngr uses a <strong>local-first architecture</strong> where you hold the encryption keys—not a cloud provider.
                        </p>

                        <h4>Key Features</h4>
                        <ul>
                            <li><strong>Ed25519 Signatures:</strong> Every block change is signed with military-grade cryptography. Tampering is mathematically detectable.</li>
                            <li><strong>Client-Side Encryption:</strong> Data is encrypted before leaving your device. Even if intercepted, it's unreadable without your keys.</li>
                            <li><strong>Provenance Tracking:</strong> Every edit records who made it, when, and from where—creating an immutable audit trail.</li>
                        </ul>

                        <h4>Use Cases</h4>
                        <div className="help-code-block">
                            <p className="code-label">Example: Legal Contracts</p>
                            <p className="code-text">
                                Law firms can draft contracts where each clause has a cryptographic signature. If opposing counsel tries to modify a term during negotiation, the signature breaks, and the change is flagged.
                            </p>
                        </div>
                        <div className="help-code-block">
                            <p className="code-label">Example: Compliance Documentation</p>
                            <p className="code-text">
                                Healthcare organizations can maintain HIPAA-compliant records where every access and modification is cryptographically logged, providing undeniable proof for audits.
                            </p>
                        </div>

                        <h4>How to Use</h4>
                        <p className="help-instructions">
                            • Navigate to the <strong>Governance Hub (🛡️)</strong> to view signatures and provenance data<br />
                            • Click the lock icon (🔏) next to any block to view its security metadata<br />
                            • Admin users can lock blocks to prevent unauthorized edits
                        </p>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">02</span> Live Transclusion</h3>

                        <h4>What It Is</h4>
                        <p>
                            Transclusion lets you embed live references to blocks from other documents. Instead of copy-pasting (which creates stale duplicates), you insert a <strong>live link</strong> that updates automatically when the source changes.
                        </p>

                        <h4>Key Features</h4>
                        <ul>
                            <li><strong>Real-Time Updates:</strong> Change the source once, and every reference updates instantly across all documents and users.</li>
                            <li><strong>Single Source of Truth:</strong> No more version conflicts or outdated data scattered across files.</li>
                            <li><strong>Smart Grid Integration:</strong> Import data tables that stay synchronized with their original source.</li>
                        </ul>

                        <h4>Use Cases</h4>
                        <div className="help-code-block">
                            <p className="code-label">Example: Product Specifications</p>
                            <p className="code-text">
                                Engineering maintains a master spec document. Product docs, marketing materials, and support articles all transclude from this source. When specs change, every document updates automatically—no manual syncing.
                            </p>
                        </div>
                        <div className="help-code-block">
                            <p className="code-label">Example: Financial Dashboards</p>
                            <p className="code-text">
                                Finance team maintains quarterly revenue data. Executive reports, board presentations, and investor decks all transclude this data. Update Q3 numbers once, and all stakeholder materials reflect the change instantly.
                            </p>
                        </div>

                        <h4>How to Use</h4>
                        <p className="help-instructions">
                            • Type <code>[[</code> to open the reference picker and search for blocks<br />
                            • Click the transclusion icon (🔗) in the toolbar to insert a reference<br />
                            • Transcluded blocks appear with a subtle border and update automatically<br />
                            • Click on a transcluded block to navigate to its source document
                        </p>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">03</span> Editor Gutter Controls</h3>

                        <h4>What They Are</h4>
                        <p>
                            On the left side of each block in the editor, you'll see two icons: a <strong>padlock (🔏)</strong> and an <strong>info button (ℹ️)</strong>. These provide quick access to security and metadata controls.
                        </p>

                        <h4>🔏 Padlock Button</h4>
                        <ul>
                            <li><strong>Purpose:</strong> Lock or unlock a block to prevent/allow edits</li>
                            <li><strong>Who Can Use It:</strong> Only users with Admin or Editor roles</li>
                            <li><strong>Visual Indicator:</strong> Locked blocks show a solid padlock, unlocked blocks show an open lock</li>
                            <li><strong>Use Case:</strong> Lock finalized contract clauses, approved budget figures, or signed-off specifications to prevent accidental changes</li>
                        </ul>
                        <div className="help-code-block">
                            <p className="code-label">Example: Locking a Budget Line</p>
                            <p className="code-text">
                                CFO approves Q4 budget allocation. Click 🔏 on that block to lock it. Now only admins can modify it, preventing accidental edits during review meetings.
                            </p>
                        </div>

                        <h4>ℹ️ Info Button</h4>
                        <ul>
                            <li><strong>Purpose:</strong> View and edit block metadata (classification, ACLs, provenance)</li>
                            <li><strong>Opens:</strong> Metadata panel on the right side</li>
                            <li><strong>What You Can Change:</strong> Security classification, access control lists, block tags</li>
                        </ul>

                        <h4>Changing Security Classifications</h4>
                        <p className="help-instructions">
                            <strong>Step 1:</strong> Click the ℹ️ button on any block<br />
                            <strong>Step 2:</strong> In the Metadata Panel, find the "Classification" dropdown<br />
                            <strong>Step 3:</strong> Select: Public, Internal, Confidential, or Restricted<br />
                            <strong>Step 4:</strong> Click "Save Metadata" to apply changes<br />
                            <strong>Note:</strong> Changing classification to Confidential/Restricted automatically updates access permissions
                        </p>

                        <div className="help-code-block">
                            <p className="code-label">Example: Classifying Sensitive Data</p>
                            <p className="code-text">
                                Your document contains customer revenue data. Click ℹ️ on those blocks, change classification to "Confidential", and set ACLs to only allow Finance team access. Now that data is cryptographically protected and access-controlled.
                            </p>
                        </div>

                        <h4>Classification Levels Explained</h4>
                        <ul>
                            <li><strong>Public:</strong> No restrictions, shareable externally</li>
                            <li><strong>Internal:</strong> Company-wide access, not for external sharing</li>
                            <li><strong>Confidential:</strong> Department/team-level access only, encrypted</li>
                            <li><strong>Restricted:</strong> Named individuals only, highest security, audit-logged</li>
                        </ul>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">04</span> Capability Tokens</h3>

                        <h4>What It Is</h4>
                        <p>
                            Traditional security checks data permissions on every access (slow). Capability Tokens are <strong>cryptographic proof</strong> that you already have permission—like a pre-approved ticket that's verified instantly.
                        </p>

                        <h4>Performance Comparison</h4>
                        <div className="help-grid">
                            <div className="help-stat-card standard">
                                <p className="stat-label">Traditional ACL Check</p>
                                <p className="stat-value slow">~120ms</p>
                                <p className="stat-detail">Database query, role lookup, permission eval</p>
                            </div>
                            <div className="help-stat-card token">
                                <p className="stat-label">Capability Token</p>
                                <p className="stat-value fast">~5ms</p>
                                <p className="stat-detail">Local cryptographic verification only</p>
                            </div>
                        </div>

                        <h4>Use Cases</h4>
                        <div className="help-code-block">
                            <p className="code-label">Example: Medical Records Access</p>
                            <p className="code-text">
                                Doctor requests patient chart. System issues a time-limited capability token. Doctor can now access that specific chart for the next hour without repeated permission checks—enabling smooth, fast workflow while maintaining strict access control.
                            </p>
                        </div>
                        <div className="help-code-block">
                            <p className="code-label">Example: Classified Document Sharing</p>
                            <p className="code-text">
                                Intelligence analyst with "Top Secret" clearance receives a capability token for a specific operation folder. Token expires after 24 hours and is revoked if analyst's clearance changes—zero-trust security without performance penalties.
                            </p>
                        </div>

                        <h4>How It Works</h4>
                        <p className="help-instructions">
                            • Tokens are issued when you first access a restricted resource<br />
                            • They're stored locally and verified cryptographically (no server calls)<br />
                            • Tokens auto-expire after their time limit or when permissions change<br />
                            • View active tokens in the <strong>Governance Hub</strong> under "Active Capabilities"
                        </p>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">05</span> Dual-View Editing</h3>

                        <h4>What It Is</h4>
                        <p>
                            Edit in <strong>Document Mode</strong> (📝) for writing and structure, or switch to <strong>Slides Mode</strong> (📊) for presentations. Both views work with the same underlying data—no exports or conversions needed.
                        </p>

                        <h4>Key Features</h4>
                        <ul>
                            <li><strong>Instant Switching:</strong> Toggle between doc and slides without saving or converting.</li>
                            <li><strong>Live Sync:</strong> Changes in one view appear immediately in the other.</li>
                            <li><strong>Split View:</strong> See both doc and slides simultaneously (🌓) for dual-screen workflows.</li>
                            <li><strong>Collaborative:</strong> Team members can edit docs while others present slides, all in real-time.</li>
                        </ul>

                        <h4>Use Cases</h4>
                        <div className="help-code-block">
                            <p className="code-label">Example: Executive Briefings</p>
                            <p className="code-text">
                                Analyst drafts detailed research in document mode. During exec meeting, they switch to slides mode for presentation. Executive asks for clarification on a data point—analyst switches back to doc mode, adds a note, and the slide updates live during the meeting.
                            </p>
                        </div>
                        <div className="help-code-block">
                            <p className="code-label">Example: Educational Content</p>
                            <p className="code-text">
                                Professor writes comprehensive lecture notes in doc mode. Class presentation uses slides mode with the same content. Students can later review the detailed notes that match exactly what was presented—no slide deck vs. handout discrepancies.
                            </p>
                        </div>

                        <h4>How to Use</h4>
                        <p className="help-instructions">
                            • Use the sidebar icons to switch views: 📝 Document, 📊 Slides, 🌓 Split<br />
                            • In slides mode, use arrow keys or slide navigation to move between pages<br />
                            • Blocks marked as headers automatically become slide titles<br />
                            • Use <code>---</code> (horizontal rule) to manually create slide breaks
                        </p>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">05</span> Smart Data Grid</h3>

                        <h4>What It Is</h4>
                        <p>
                            Interactive spreadsheet-like tables that live inside your documents. Unlike static tables, Smart Grids support formulas, sorting, filtering, and data validation—while maintaining the same security and versioning as your text.
                        </p>

                        <h4>Key Features</h4>
                        <ul>
                            <li><strong>Excel-Like Formulas:</strong> Use SUM, AVERAGE, COUNT, and other functions.</li>
                            <li><strong>Data Validation:</strong> Set cell types (number, date, dropdown) for data integrity.</li>
                            <li><strong>Live Collaboration:</strong> Multiple users can edit cells simultaneously with conflict resolution.</li>
                            <li><strong>Version Control:</strong> Every cell change is tracked with full audit history.</li>
                        </ul>

                        <h4>Use Cases</h4>
                        <div className="help-code-block">
                            <p className="code-label">Example: Budget Planning</p>
                            <p className="code-text">
                                Finance team embeds a Smart Grid in the quarterly budget doc. Department heads edit their own rows. Formulas auto-calculate totals and variances. Every change is signed and logged—perfect for audit compliance while maintaining spreadsheet convenience.
                            </p>
                        </div>

                        <h4>How to Use</h4>
                        <p className="help-instructions">
                            • Type <code>/grid</code> and press Enter to insert a new Smart Grid<br />
                            • Click cells to edit, double-click for formula mode<br />
                            • Right-click column headers for sort, filter, and formatting options<br />
                            • Open <strong>Extensions Store (🛍️)</strong> to install pre-built grid templates
                        </p>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">06</span> Governance Dashboard</h3>

                        <h4>What It Is</h4>
                        <p>
                            The <strong>Governance Hub (🛡️)</strong> provides an "X-Ray view" of your document's security posture, showing classification distribution, provenance data, and compliance status at a glance.
                        </p>

                        <h4>Key Features</h4>
                        <ul>
                            <li><strong>Classification Stats:</strong> See how many blocks are Public, Internal, Confidential, or Restricted</li>
                            <li><strong>Lineage Table:</strong> View complete audit trail (who created/modified blocks, when, from where)</li>
                            <li><strong>Compliance Tools:</strong> Export reports and verify cryptographic signatures</li>
                        </ul>

                        <h4>📥 Export Compliance Report (PDF)</h4>
                        <p>
                            This button generates a comprehensive PDF audit report for regulatory compliance, security audits, or internal reviews.
                        </p>

                        <div className="help-code-block">
                            <p className="code-label">What's Included in the Report</p>
                            <p className="code-text">
                                • Document metadata (creation date, authors, version)<br />
                                • Classification breakdown with statistics<br />
                                • Complete provenance audit trail (every edit, timestamp, author)<br />
                                • Signature verification status for all blocks<br />
                                • Access control list (ACL) summary<br />
                                • Locked block inventory
                            </p>
                        </div>

                        <h4>Use Cases for Compliance Reports</h4>
                        <div className="help-code-block">
                            <p className="code-label">Example: SOC 2 Audit</p>
                            <p className="code-text">
                                Auditor requests proof of access controls and change tracking. Export compliance report showing every modification is cryptographically signed, all sensitive data is classified correctly, and access is role-restricted.
                            </p>
                        </div>
                        <div className="help-code-block">
                            <p className="code-label">Example: GDPR Data Processing</p>
                            <p className="code-text">
                                Data Protection Officer needs evidence of who accessed customer data and when. Compliance report provides complete lineage trail with timestamps, showing compliance with Article 30 record-keeping requirements.
                            </p>
                        </div>

                        <h4>🔍 Verify All Signatures</h4>
                        <p>
                            This button performs cryptographic verification of <strong>every block's digital signature</strong> to ensure document integrity and detect any tampering.
                        </p>

                        <h4>How Signature Verification Works</h4>
                        <p className="help-instructions">
                            <strong>What it checks:</strong><br />
                            • Each block's content matches its cryptographic signature<br />
                            • Author identity is verified using their public key<br />
                            • Timestamp hasn't been backdated or altered<br />
                            • Provenance chain is intact (no gaps in edit history)<br />
                            <br />
                            <strong>Results:</strong><br />
                            ✅ <strong>Verified:</strong> All signatures valid, document is tamper-proof<br />
                            ⚠️ <strong>Warning:</strong> Some signatures missing (older blocks before signing was enabled)<br />
                            ❌ <strong>Failed:</strong> Signature mismatch detected - content has been altered
                        </p>

                        <div className="help-code-block">
                            <p className="code-label">Example: Legal Contract Verification</p>
                            <p className="code-text">
                                Before final contract signing, legal team clicks "Verify All Signatures" to ensure no clauses were modified after attorney review. Green checkmarks confirm document integrity; any red flags would halt the signing process.
                            </p>
                        </div>

                        <h4>When to Use Verification</h4>
                        <ul>
                            <li><strong>Before critical decisions:</strong> Contract signing, financial approvals, policy publication</li>
                            <li><strong>After receiving documents:</strong> Verify third-party documents haven't been tampered with</li>
                            <li><strong>Regular audits:</strong> Weekly/monthly verification for high-security documents</li>
                            <li><strong>Compliance requirements:</strong> Some regulations require periodic integrity checks</li>
                        </ul>

                        <h4>Accessing the Governance Dashboard</h4>
                        <p className="help-instructions">
                            • Click the <strong>🛡️ shield icon</strong> in the left sidebar<br />
                            • Use search bar to filter blocks by author, classification, or ID<br />
                            • Click any block ID in the table to navigate to that block in the editor<br />
                            • Export and verify buttons are at the bottom of the dashboard
                        </p>
                    </section>

                    <hr className="help-divider" />

                    <section className="help-section">
                        <h3><span className="section-number">07</span> AI Assistant (✨)</h3>

                        <h4>What It Is</h4>
                        <p>
                            Context-aware AI that understands your document structure, security policies, and collaboration history. Ask questions, request edits, or get suggestions—all while respecting your access permissions.
                        </p>

                        <h4>Key Features</h4>
                        <ul>
                            <li><strong>Document-Aware:</strong> AI knows your current doc structure and can reference specific blocks.</li>
                            <li><strong>Permission-Scoped:</strong> AI only suggests edits you're authorized to make based on your role.</li>
                            <li><strong>Action Dispatch:</strong> AI can directly edit documents, create grids, and insert references (with your approval).</li>
                        </ul>

                        <h4>Example Prompts</h4>
                        <div className="help-code-block">
                            <p className="code-label">"Summarize this document"</p>
                            <p className="code-text">AI creates a summary block at the top of your document.</p>
                        </div>
                        <div className="help-code-block">
                            <p className="code-label">"Create a grid for tracking project milestones"</p>
                            <p className="code-text">AI inserts a Smart Grid with columns: Task, Owner, Due Date, Status.</p>
                        </div>
                        <div className="help-code-block">
                            <p className="code-label">"Find all blocks mentioning Q4 revenue"</p>
                            <p className="code-text">AI searches and highlights matching blocks across your document.</p>
                        </div>

                        <h4>How to Use</h4>
                        <p className="help-instructions">
                            • Click the <strong>✨ Ask AI</strong> button in the top toolbar<br />
                            • Type your question or request in natural language<br />
                            • Review AI suggestions before accepting changes<br />
                            • AI responses respect your current view mode and security clearance
                        </p>
                    </section>

                    <div className="help-note">
                        <h4>🌐 Deployment Notes</h4>
                        <p>
                            <strong>Browser Mode:</strong> Cloud sync via Supabase. Local file saving disabled for security.<br />
                            <strong>Desktop App:</strong> Full local-first mode with optional cloud sync and file system access.<br />
                            <strong>Enterprise:</strong> Self-hosted backend with custom SSO, audit logging, and compliance tools.
                        </p>
                    </div>

                    <div className="help-footer-text">
                        Corngr Prototype v6.5 • Secure Enterprise Data OS
                    </div>
                </div>
            </div>
        </div >
    );
};
