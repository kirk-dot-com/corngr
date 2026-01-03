import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { EditorView } from 'prosemirror-view';
import { User, Role } from './security/types';
import './DemoApp.css';

import { TauriWebSocketProvider } from './providers/TauriWebSocketProvider';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { MarketplaceSidebar } from './components/MarketplaceSidebar';
import { GovernanceDashboard } from './components/governance/GovernanceDashboard';
import { MetadataPanel } from './components/MetadataPanel';

import { generateUUID } from './yjs/schema';

import { HelpPanel } from './components/HelpPanel';
import { InputModal } from './components/InputModal';
import { CommandPalette, CommandAction } from './components/CommandPalette';
import { ModeIndicator } from './components/ModeIndicator';
import { AppHeader } from './components/AppHeader';
import { EditorPanel } from './components/editor/EditorPanel';
import { SlidesPanel } from './components/editor/SlidesPanel';
import { CollaborationPerformanceTest } from './components/collaboration/CollaborationPerformanceTest';
import { ActiveUsersList } from './components/collaboration/ActiveUsersList';
import { PresenceNotifications } from './components/collaboration/PresenceNotifications';

import { MetadataStore } from './metadata/MetadataStore';
import { GlobalReferenceStore } from './security/GlobalReferenceStore';
import { marketplaceStore } from './stores/MarketplaceStore'; // Import store

// Layout Components
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { SideNav, ViewMode } from './components/layout/SideNav';

// Mock Users
const USERS: Record<Role, User> = {
    admin: { id: 'u1', attributes: { role: 'admin', department: 'IT', clearanceLevel: 5 } },
    editor: { id: 'u2', attributes: { role: 'editor', department: 'Sales', clearanceLevel: 2 } },
    viewer: { id: 'u3', attributes: { role: 'viewer', department: 'Marketing', clearanceLevel: 0 } }
};

export const DemoApp: React.FC = () => {
    // Phase 6: Auth State (Mocked)
    const [currentDocId, setCurrentDocId] = useState<string | null>(null);
    const [currentDocTitle, setCurrentDocTitle] = useState<string>('Local Document');
    const [showHelp, setShowHelp] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Phase 1 Architecture:
    const [clientDoc, setClientDoc] = useState<Y.Doc | null>(null);

    const [view, setView] = useState<ViewMode>('split');
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [editorView, setEditorView] = useState<EditorView | null>(null);

    // Replaced secureNetwork with specific local stores
    const [wsProvider, setWsProvider] = useState<TauriWebSocketProvider | null>(null);
    const [metadataStore] = useState(() => new MetadataStore());
    const [referenceStore] = useState(() => new GlobalReferenceStore());

    // Security State
    const [currentUser, setCurrentUser] = useState<User>(USERS.admin);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [showMetadataPanel, setShowMetadataPanel] = useState(false);

    // Performance Testing State
    const [autoMutate, setAutoMutate] = useState(false);

    // Marketplace State
    const [showMarketplace, setShowMarketplace] = useState(false);

    // Collaboration State
    const [activeUserCount, setActiveUserCount] = useState(1);
    const [showInputModal, setShowInputModal] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [appMode, setAppMode] = useState<'draft' | 'audit' | 'presentation'>('draft');

    // [Phase 6] New Collaboration UI State
    const [showPerfTest, setShowPerfTest] = useState(false);
    const [showActiveUsers, setShowActiveUsers] = useState(true);
    const [_followingUserId, setFollowingUserId] = useState<number | null>(null);

    const handleGlobalCreateConfirm = async (title: string) => {
        const effectiveTitle = title.trim() || 'Untitled Document';
        const uuid = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const newDocId = `doc_${uuid}`;

        setShowInputModal(false);
        setCurrentDocId(newDocId);
        setCurrentDocTitle(effectiveTitle);
        window.location.hash = newDocId;
    };

    // Initialize/Route Document
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.startsWith('#doc_')) {
            setCurrentDocId(hash.substring(1));
        } else {
            // Default to doc_default if no hash
            setCurrentDocId('doc_default');
            window.location.hash = 'doc_default';
        }

        const handleHashChange = () => {
            const h = window.location.hash;
            if (h.startsWith('#doc_')) {
                setCurrentDocId(h.substring(1));
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // [Phase 7] Command Palette
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Subscribe to Marketplace Store just to re-render if needed (optional if only editor needs it)
    useEffect(() => {
        return marketplaceStore.subscribe(() => {
            // Trigger update? Not strictly necessary if editor subscribes, but good for global UI state
        });
    }, []);

    const handleStressTest = async () => {
        alert("Stress Test temporarily disabled during architecture cleanup.");
    };

    // Save logic
    const handleSave = async () => {
        setIsSaving(true);
        console.log("💾 Triggering Save on Server...");
        setTimeout(() => setIsSaving(false), 800);
    };

    const commandActions: CommandAction[] = [
        { id: 'new-doc', label: 'New Document', icon: '➕', category: 'Application', shortcut: '⌘N', onExecute: () => setShowInputModal(true) },
        { id: 'save-doc', label: 'Save Document', icon: '💾', category: 'Application', shortcut: '⌘S', onExecute: handleSave },
        { id: 'mode-draft', label: 'Switch to Drafting Mode', icon: '📝', category: 'Navigation', onExecute: () => setAppMode('draft') },
        { id: 'mode-audit', label: 'Switch to Audit Mode', icon: '🛡️', category: 'Governance', onExecute: () => setAppMode('audit') },
        { id: 'mode-presentation', label: 'Switch to Presentation Mode', icon: '📊', category: 'Presentation', onExecute: () => setAppMode('presentation') },
        { id: 'stress-test', label: 'Run Performance Stress Test', icon: '🧪', category: 'Governance', onExecute: handleStressTest },
    ];

    // Initialize Document & Network
    useEffect(() => {
        if (!currentDocId) return;

        console.log(`🔌 Initializing Tauri WebSocket for ${currentDocId}`);
        const cDoc = new Y.Doc();
        setClientDoc(cDoc);

        const provider = new TauriWebSocketProvider(currentDocId, cDoc);
        const awareness = provider.awareness;

        awareness.setLocalStateField('user', {
            name: `${currentUser.attributes.role} (You)`,
            color: currentUser.attributes.role === 'admin' ? '#ff4b2b' : '#667eea',
            id: currentUser.id
        });

        setWsProvider(provider);
        (window as any).tauriNetwork = provider;

        return () => {
            console.log('🧹 Cleaning up TauriWebSocketProvider...');
            provider.destroy();
            cDoc.destroy();
        };
    }, [currentDocId, currentUser]); // Re-init if doc or user changes

    // Update User Role in Awareness
    useEffect(() => {
        if (wsProvider) {
            wsProvider.awareness.setLocalStateField('user', {
                name: `${currentUser.attributes.role} (You)`,
                color: currentUser.attributes.role === 'admin' ? '#ff4b2b' : '#667eea',
                id: currentUser.id
            });
        }
    }, [currentUser, wsProvider]);

    // Awareness Listener
    useEffect(() => {
        if (!wsProvider) return;
        const awareness = wsProvider.awareness;
        const handleAwarenessChange = () => {
            setActiveUserCount(awareness.getStates().size);
        };
        awareness.on('change', handleAwarenessChange);
        return () => {
            awareness.off('change', handleAwarenessChange);
        };
    }, [wsProvider]);

    // Auto-Mutate Loop
    useEffect(() => {
        if (!autoMutate || !clientDoc) return;
        const interval = setInterval(() => {
            clientDoc.transact(() => {
                const content = clientDoc.getArray('content');
                if (content.length > 0) {
                    // Simple mutation
                }
            });
        }, 50);
        return () => clearInterval(interval);
    }, [autoMutate, clientDoc]);

    const handleImportBlock = (/* legacy */) => {
        // Logic removed as functionality moved to Slash Commands via Marketplace installation
    };

    const insertGlobalTransclusion = () => {
        if (!clientDoc) return;
        const refId = 'ext-ref-' + Math.random().toString(36).substring(7);
        referenceStore.addReference({
            id: refId, targetDocId: 'doc-alpha-99', targetBlockId: 'b3',
            originUrl: 'https://security.corngr.com/vault/finance-2024.crng',
            lastVerified: new Date().toISOString(), status: 'active'
        });
        const fragment = clientDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
        clientDoc.transact(() => {
            const node = new Y.XmlElement('inline-reference');
            node.setAttribute('refId', refId);
            node.setAttribute('fallbackText', 'Resolving Finance Data...');
            fragment.push([node]);
        });
    };

    useEffect(() => {
        if (!editorContainerRef.current) return;
        const interval = setInterval(() => {
            const pmEditor = editorContainerRef.current?.querySelector('.ProseMirror') as any;
            if (pmEditor?.pmViewDesc?.view) {
                setEditorView(pmEditor.pmViewDesc.view);
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [clientDoc, view]);

    if (!clientDoc) return <div className="demo-app loading"><div className="loading-spinner"><h1>Connecting to Local Cloud...</h1></div></div>;

    // --- Layout Composition ---

    const rightPanelContent = showMarketplace ? (
        <MarketplaceSidebar
            onClose={() => setShowMarketplace(false)}
        />
    ) : showMetadataPanel ? (
        <MetadataPanel
            selectedBlockId={selectedBlockId}
            metadataStore={metadataStore}
            user={currentUser}
            onClose={() => setShowMetadataPanel(false)}
            onSave={handleSave}
        />
    ) : null;

    return (
        <WorkspaceLayout
            sideNav={
                <SideNav
                    currentView={view}
                    currentUser={currentUser}
                    onViewChange={setView}
                    onRoleChange={() => {
                        const roles: Role[] = ['admin', 'editor', 'viewer'];
                        const nextIdx = (roles.indexOf(currentUser.attributes.role) + 1) % roles.length;
                        setCurrentUser(USERS[roles[nextIdx]]);
                    }}
                />
            }
            topBar={
                <AppHeader
                    currentDocTitle={currentDocTitle}
                    isSaving={isSaving}
                    activeUserCount={activeUserCount}
                    awareness={wsProvider?.awareness}
                    showMarketplace={showMarketplace}
                    showMetadataPanel={showMetadataPanel}
                    onShowCommandPalette={() => setShowCommandPalette(true)}
                    onShowCreateModal={() => setShowInputModal(true)}
                    onToggleMarketplace={() => { setShowMarketplace(!showMarketplace); if (!showMarketplace) setShowMetadataPanel(false); }}
                    onToggleMetadataPanel={() => { setShowMetadataPanel(!showMetadataPanel); if (!showMetadataPanel) setShowMarketplace(false); }}
                    onToggleHelp={() => setShowHelp(!showHelp)}
                    onSave={handleSave}
                />
            }
            rightPanel={rightPanelContent}
            modals={
                <>
                    <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />
                    <InputModal
                        isOpen={showInputModal}
                        title="Create New Document"
                        placeholder="Untitled Document"
                        confirmLabel="Create"
                        onCancel={() => setShowInputModal(false)}
                        onConfirm={handleGlobalCreateConfirm}
                    />
                    <CommandPalette
                        isOpen={showCommandPalette}
                        onClose={() => setShowCommandPalette(false)}
                        actions={commandActions}
                    />
                    <ModeIndicator mode={appMode} />
                </>
            }
        >
            {/* Main Content Area */}
            <PerformanceMonitor yDoc={clientDoc} />

            <div className={`demo-content view-${view}`} style={{ height: '100%', overflow: 'hidden' }}>
                {(view === 'split' || view === 'editor') && (
                    <EditorPanel
                        yDoc={clientDoc}
                        user={currentUser}
                        metadataStore={metadataStore}
                        awareness={wsProvider?.awareness || null}
                        editorView={editorView}
                        appMode={appMode}
                        onBlockSelect={(id) => { setSelectedBlockId(id); if (id && !showMetadataPanel && !showMarketplace) setShowMetadataPanel(true); }}
                        editorContainerRef={editorContainerRef as React.RefObject<HTMLDivElement>}
                    />
                )}
                {(view === 'split' || view === 'slides') && (
                    <SlidesPanel yDoc={clientDoc} user={currentUser} />
                )}
                {view === 'governance' && (
                    <div className="governance-panel" style={{ padding: '20px', overflow: 'auto', height: '100%' }}>
                        <GovernanceDashboard metadataStore={metadataStore} yDoc={clientDoc} />
                    </div>
                )}
            </div>

            <div className="collab-controls" style={{ bottom: '20px', left: '80px', zIndex: 50 }}>
                <button
                    className={`collab-toggle-btn ${showPerfTest ? 'active' : ''}`}
                    onClick={() => setShowPerfTest(!showPerfTest)}
                    title="Toggle Performance Monitor"
                >
                    📊
                </button>
            </div>

            {wsProvider && showPerfTest && (
                <CollaborationPerformanceTest
                    awareness={wsProvider.awareness}
                    doc={clientDoc}
                />
            )}
        </WorkspaceLayout>
    );
};
