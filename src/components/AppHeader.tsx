import React from 'react';
import { PresenceAvatars } from './collaboration/PresenceAvatars';

interface AppHeaderProps {
    currentDocTitle: string;
    isSaving: boolean;
    activeUserCount: number;
    awareness?: any; // Yjs Awareness
    showMarketplace: boolean;
    showMetadataPanel: boolean;

    onShowCommandPalette: () => void;
    onShowCreateModal: () => void;
    onToggleMarketplace: () => void;
    onToggleMetadataPanel: () => void;
    onToggleHelp: () => void;
    onSave: () => void;
}

/**
 * AppHeader (TopBar)
 * 
 * Simplified for the Unified Workspace Layout.
 * Handles Document Context, Search Trigger, and Utility Toggles.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
    currentDocTitle,
    isSaving,
    activeUserCount,
    awareness,
    showMarketplace,
    showMetadataPanel,
    onShowCommandPalette,
    onShowCreateModal,
    onToggleMarketplace,
    onToggleMetadataPanel,
    onToggleHelp,
    onSave,
}) => {
    return (
        <header className="app-top-bar" style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left: Document Context */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#1a202c' }}>{currentDocTitle || 'Untitled Document'}</div>
                <div style={{ fontSize: '0.8rem', color: '#718096', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isSaving ? <span style={{ color: '#ed8936' }}>☁️ Syncing...</span> : <span style={{ color: '#48bb78' }}>✓ Saved</span>}
                </div>
            </div>

            {/* Center: Omni Search */}
            <button
                onClick={onShowCommandPalette}
                style={{
                    background: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: '#a0aec0',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    width: '320px',
                    textAlign: 'left',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
            >
                🔍 Search or type command... (⌘K)
            </button>

            {/* Right: Actions & Presence */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* Presence */}
                {awareness && (
                    <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center' }}>
                        <PresenceAvatars awareness={awareness} localClientId={awareness.clientID} />
                        <span style={{ fontSize: '0.8rem', color: '#718096', marginLeft: '6px' }}>{activeUserCount}</span>
                    </div>
                )}

                <ActionBtn onClick={onShowCreateModal} title="New Document" icon="➕" />
                <Divider />

                <ActionBtn
                    onClick={onToggleMarketplace}
                    title="Marketplace"
                    icon="🛒"
                    active={showMarketplace}
                />
                <ActionBtn
                    onClick={onToggleMetadataPanel}
                    title="Metadata Panel"
                    icon="🏷️"
                    active={showMetadataPanel}
                />
                <ActionBtn
                    onClick={onToggleHelp}
                    title="Help"
                    icon="❓"
                />
            </div>
        </header>
    );
};

const ActionBtn: React.FC<{ onClick: () => void, title: string, icon: string, active?: boolean }> = ({ onClick, title, icon, active }) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            background: active ? '#ebf8ff' : 'transparent',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            transition: 'all 0.2s',
            color: active ? '#3182ce' : '#4a5568',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}
    >
        {icon}
    </button>
);

const Divider = () => (
    <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 8px' }}></div>
);
