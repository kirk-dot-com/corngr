import React from 'react';
import { ViewControls } from './ViewControls';
import { DevTools } from './DevTools';
import { Role } from '../security/types';

type ViewMode = 'split' | 'editor' | 'slides' | 'governance';

interface AppHeaderProps {
    currentDocId: string | null;
    currentDocTitle: string;
    currentView: ViewMode;
    autoMutate: boolean;
    showMarketplace: boolean;
    showMetadataPanel: boolean;
    showHelp: boolean;
    isSaving: boolean;
    activeUserCount: number;
    currentRole: Role;
    onBack: () => void;
    onViewChange: (view: ViewMode) => void;
    onToggleAutoMutate: () => void;
    onInsertTransclusion: () => void;
    onInjectMassiveData: () => void;
    onRunStressTest: () => void;
    onToggleMarketplace: () => void;
    onToggleMetadataPanel: () => void;
    onToggleHelp: () => void;
    onSave: () => Promise<void>;
    onRoleChange: (role: Role) => void;
    onShowCommandPalette: () => void;
    onShowCreateModal: () => void;
}

/**
 * AppHeader - Main application header with navigation and controls
 * 
 * Contains:
 * - Branding and document context
 * - Command palette launcher
 * - View mode controls
 * - Dev tools
 * - User/role selector
 * - Active user indicator
 * 
 * Phase 5: Polish - Extracted from DemoApp for better component organization
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
    currentDocId,
    currentDocTitle,
    currentView,
    autoMutate,
    showMarketplace,
    showMetadataPanel,
    showHelp,
    isSaving,
    activeUserCount,
    currentRole,
    onBack,
    onViewChange,
    onToggleAutoMutate,
    onInsertTransclusion,
    onInjectMassiveData,
    onRunStressTest,
    onToggleMarketplace,
    onToggleMetadataPanel,
    onToggleHelp,
    onSave,
    onRoleChange,
    onShowCommandPalette,
    onShowCreateModal
}) => {
    return (
        <header className="demo-header">
            <div className="header-content">
                {currentDocId && (
                    <button
                        onClick={onBack}
                        className="view-btn back-btn"
                        title="Back to Dashboard"
                    >
                        ⬅
                    </button>
                )}
                <div className="branding-stack">
                    <div className="branding">
                        <h1>🌽 Corngr Phase 3</h1>
                        <p className="tagline">Ecosystem & Marketplace Integration</p>
                    </div>
                    {currentDocTitle && (
                        <div className="doc-context-line">
                            <span className="label">DOCUMENT:</span>
                            <span className="title-text">{currentDocTitle}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="view-controls">
                <button
                    onClick={onShowCommandPalette}
                    className="view-btn omni-btn"
                    title="Open Command Palette (⌘K)"
                >
                    🔍 Omni
                </button>
                <div className="divider"></div>

                <button
                    onClick={onShowCreateModal}
                    className="view-btn primary"
                >
                    ➕ New Document
                </button>
                <div className="divider"></div>

                <ViewControls
                    currentView={currentView}
                    onViewChange={onViewChange}
                />
                <div className="divider"></div>

                <DevTools
                    autoMutate={autoMutate}
                    onToggleAutoMutate={onToggleAutoMutate}
                    onInsertTransclusion={onInsertTransclusion}
                    onInjectMassiveData={onInjectMassiveData}
                    onRunStressTest={onRunStressTest}
                />
                <div className="divider"></div>

                <button
                    className={`view-btn ${showMarketplace ? 'active' : ''}`}
                    onClick={onToggleMarketplace}
                >
                    🛒 Market
                </button>
                <button
                    className={`view-btn ${showMetadataPanel ? 'active' : ''}`}
                    onClick={onToggleMetadataPanel}
                >
                    🏷️ Meta
                </button>
                <div className="divider"></div>

                <button
                    className={`view-btn ${isSaving ? 'active' : ''}`}
                    onClick={onSave}
                    disabled={isSaving}
                >
                    {isSaving ? '☁️ Syncing...' : '💾 Save'}
                </button>
                <div className="divider"></div>

                <select
                    value={currentRole}
                    onChange={(e) => onRoleChange(e.target.value as Role)}
                    className="role-select"
                >
                    <option value="admin">👮 Admin</option>
                    <option value="editor">✏️ Editor</option>
                    <option value="viewer">👀 Viewer</option>
                </select>

                <button
                    className={`view-btn ${showHelp ? 'active' : ''}`}
                    onClick={onToggleHelp}
                >
                    ❓ Help
                </button>

                <div className="active-users-indicator">
                    <div className="status-dot online"></div>
                    <span>{activeUserCount} Active</span>
                </div>
            </div>
        </header>
    );
};
