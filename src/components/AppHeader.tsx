import React, { useEffect, useState } from 'react';
import { useYjs } from '../yjs/YjsProvider';
import { UserContext } from '../security/UserContext';
import { MetadataStore } from '../metadata/MetadataStore';
import { sidecarStore } from '../stores/SidecarStore';
import './AppHeader.css';

interface TopBarProps {
    title?: string;
    onToggleMarketplace?: () => void;
    onToggleMetadata?: () => void;
    onToggleHelp?: () => void;
    metadataStore?: MetadataStore;
}

export const TopBar: React.FC<TopBarProps> = ({
    title = 'Untitled Doc',
    onToggleMarketplace,
    onToggleMetadata,
    onToggleHelp
}) => {
    const { connected, users } = useYjs();
    const { user } = React.useContext(UserContext);
    const [status, setStatus] = React.useState('Offline');

    // Subscribe to Sidecar State for UI button active state
    const [isSidecarOpen, setSidecarOpen] = useState(false);
    useEffect(() => {
        const update = () => setSidecarOpen(sidecarStore.isOpen);
        update();
        const unsubscribe = sidecarStore.subscribe(update);
        return () => { unsubscribe(); };
    }, []);

    React.useEffect(() => {
        if (!connected) setStatus('Reconnecting...');
        else setStatus('Saved');
    }, [connected]);

    return (
        <header className="top-bar">
            {/* Left: Context */}
            <div className="top-bar-left">
                <div className="doc-icon">📄</div>
                <div className="doc-info">
                    <div className="doc-title-wrapper">
                        <span className="doc-title">{title}</span>
                        <button className="doc-dropdown-btn" title="Switch Document" onClick={() => {
                            const dropdown = document.getElementById('doc-dropdown');
                            if (dropdown) {
                                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                            }
                        }}>▼</button>
                        <div id="doc-dropdown" className="doc-dropdown" style={{ display: 'none' }}>
                            <div className="doc-dropdown-header">Recent Documents</div>
                            <button className="doc-item active">
                                📄 Project Alpha <span className="doc-badge">Current</span>
                            </button>
                            <button className="doc-item">
                                📄 Sprint Planning Q4
                            </button>
                            <button className="doc-item">
                                📄 Technical Spec v2
                            </button>
                            <div className="doc-dropdown-divider"></div>
                            <button className="doc-item create-new">
                                ➕ Create New Document
                            </button>
                        </div>
                    </div>
                    <span className="doc-status">{status}</span>
                </div>
            </div>

            {/* Center: Search (Omnibox) */}
            <div className="top-bar-center">
                <div className="omnibox">
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Search or Type a command..." />
                    <span className="shortcut">⌘K</span>
                </div>
            </div>

            {/* Right: Actions & Tools */}
            <div className="top-bar-right">

                {/* Collaboration Avatars */}
                <div className="presence-cluster">
                    {users.map(u => (
                        <div key={u.id} className="avatar" title={u.name} style={{ background: u.color }}>
                            {u.name[0]}
                        </div>
                    ))}
                    <div className="avatar self" title={`You (${user?.name})`} style={{ background: user?.color }}>
                        {user?.name?.[0]}
                    </div>
                </div>

                <Divider />

                <ActionBtn icon="✨" label="Ask AI" active={isSidecarOpen} onClick={() => sidecarStore.toggle()} />
                <ActionBtn icon="🛍️" label="Extensions" onClick={onToggleMarketplace} />
                <ActionBtn icon="ⓘ" label="Metadata" onClick={onToggleMetadata} />
                <ActionBtn icon="?" label="Help" onClick={onToggleHelp} />

            </div>
        </header>
    );
};

const ActionBtn = ({ icon, label, onClick, active }: any) => (
    <button className={`action-btn ${active ? 'active' : ''}`} onClick={onClick} title={label}>
        <span className="icon">{icon}</span>
    </button>
);

const Divider = () => <div className="divider" />;
