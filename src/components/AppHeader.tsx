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
    onToggleSecurity?: () => void;
    onToggleHelp?: () => void;
    metadataStore?: MetadataStore;
    onDocChange?: (id: string, title?: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
    title = 'Untitled Doc',
    onToggleMarketplace,
    onToggleMetadata,
    onToggleSecurity,
    onToggleHelp,
    onDocChange
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

    const handleDocSwitch = (id: string, newTitle: string) => {
        if (onDocChange) onDocChange(id, newTitle);
        document.getElementById('doc-dropdown')!.style.display = 'none';
    };



    // This is a bit hacky but we need to track the ID locally or pass it in
    // For now we will rely on the parent updating the title

    return (
        <header className="top-bar">
            {/* Left: Context */}
            <div className="top-bar-left">
                <div className="doc-icon">📄</div>
                <div className="doc-info">
                    <div className="doc-title-wrapper">
                        <input
                            type="text"
                            className="doc-title-input"
                            value={title}
                            onChange={(e) => {
                                // We need to know the CURRENT doc ID to update its title
                                // The handleDocSwitch logic in parent (DemoApp) needs to track IDs
                                // But TopBar currently doesn't receive 'docId' prop
                                // For this quick fix, we'll just pass the NEW title and let parent handle it
                                if (onDocChange) onDocChange('_CURRENT_', e.target.value);
                            }}
                            title="Click to rename document"
                        />
                        <button className="doc-dropdown-btn" title="Switch Document" onClick={() => {
                            const dropdown = document.getElementById('doc-dropdown');
                            if (dropdown) {
                                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                            }
                        }}>▼</button>
                        <div id="doc-dropdown" className="doc-dropdown" style={{ display: 'none' }}>
                            <div className="doc-dropdown-header">Recent Documents</div>
                            <button className="doc-item active" onClick={() => handleDocSwitch('doc_default', 'Project Alpha')}>
                                📄 Project Alpha <span className="doc-badge">Current</span>
                            </button>
                            <button className="doc-item" onClick={() => handleDocSwitch('doc_sprint_q4', 'Sprint Planning Q4')}>
                                📄 Sprint Planning Q4
                            </button>
                            <button className="doc-item" onClick={() => handleDocSwitch('doc_tech_spec', 'Technical Spec v2')}>
                                📄 Technical Spec v2
                            </button>
                            <div className="doc-dropdown-divider"></div>
                            <button className="doc-item create-new" onClick={() => {
                                const newId = 'doc_' + Math.random().toString(36).substr(2, 9);
                                handleDocSwitch(newId, 'Untitled Document');
                            }}>
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
                        <div key={u.id} className="avatar" title={`${u.name} (${u.role || 'viewer'})`} style={{ background: u.color }}>
                            {u.name[0]}
                        </div>
                    ))}
                    <div className="avatar self" title={`You (${user?.name}) - ${user?.role}`} style={{ background: user?.color }}>
                        {user?.name?.[0]}
                    </div>
                </div>

                <Divider />

                <ActionBtn icon="✨" label="Ask AI" active={isSidecarOpen} onClick={() => sidecarStore.toggle()} />
                <ActionBtn icon="🛍️" label="Extensions" onClick={onToggleMarketplace} />
                <ActionBtn icon="ⓘ" label="Metadata" onClick={onToggleMetadata} />
                <ActionBtn icon="🛡️" label="Security" onClick={onToggleSecurity} />
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
