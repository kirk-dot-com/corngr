import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { EditorView } from 'prosemirror-view';
import { User, Role } from './security/types';
import { TauriSecureNetwork } from './security/TauriSecureNetwork';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { MarketplaceSidebar, MarketplaceBlock } from './components/MarketplaceSidebar';
import { GovernanceDashboard } from './components/governance/GovernanceDashboard';
import { MetadataPanel } from './components/MetadataPanel';
import { runPerformanceStressTest } from './security/PerformanceStressTest';
import { generateUUID, BlockMetadata } from './yjs/schema';
import './DemoApp.css';

// Mock Users with Clearance Levels for ABAC testing
const USERS: Record<Role, User> = {
    admin: { id: 'u1', attributes: { role: 'admin', department: 'IT', clearanceLevel: 5 } },
    editor: { id: 'u2', attributes: { role: 'editor', department: 'Sales', clearanceLevel: 2 } },
    viewer: { id: 'u3', attributes: { role: 'viewer', department: 'Marketing', clearanceLevel: 0 } }
};

import { AuthPage } from './components/AuthPage';
import { DocumentList } from './components/DocumentList';
import { HelpPanel } from './components/HelpPanel';
import { InputModal } from './components/InputModal';
import { CommandPalette, CommandAction } from './components/CommandPalette';
import { ModeIndicator } from './components/ModeIndicator';
import { AppHeader } from './components/AppHeader';
import { EditorPanel } from './components/editor/EditorPanel';
import { SlidesPanel } from './components/editor/SlidesPanel';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config/SupabaseConfig';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const DemoApp: React.FC = () => {
    // Phase 6: Authentication State
    const [session, setSession] = useState<any>(null); // Supabase Session
    const [currentDocId, setCurrentDocId] = useState<string | null>(null); // [Phase 6.5] Dashboard Routing
    const [currentDocTitle, setCurrentDocTitle] = useState<string>(''); // [Phase 6.5] Title Visibility
    const [showHelp, setShowHelp] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Phase 1 Architecture:
    const [clientDoc, setClientDoc] = useState<Y.Doc | null>(null);

    const [view, setView] = useState<'split' | 'editor' | 'slides' | 'governance'>('split');
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [editorView, setEditorView] = useState<EditorView | null>(null);
    const [secureNetwork, setSecureNetwork] = useState<TauriSecureNetwork | null>(null);

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

    const handleGlobalCreateConfirm = async (title: string) => {
        const effectiveTitle = title.trim() || 'Untitled Document';
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);

        const newDocId = `doc_${uuid}`;
        setShowInputModal(false);

        try {
            const { error } = await supabase.from('documents').insert({
                id: newDocId,
                owner_id: session.user.id,
                title: effectiveTitle,
                content: 'AAA=',
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
            setCurrentDocId(newDocId);
            setCurrentDocTitle(effectiveTitle);
            // URL hash will be updated by useEffect
        } catch (err: any) {
            console.error('❌ Failed to create document from header:', err);
            alert('Failed to create document: ' + err.message);
        }
    };

    // [Phase 6] Listen for Auth Changes
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // [Phase 6] URL Hash Routing - sync document ID across windows
    useEffect(() => {
        // Read document ID from URL hash on mount
        const hash = window.location.hash;
        if (hash.startsWith('#doc_')) {
            const docIdFromUrl = hash.substring(1); // Remove # prefix
            if (docIdFromUrl !== currentDocId) {
                console.log(`📍 Loading document from URL hash: ${docIdFromUrl}`);
                setCurrentDocId(docIdFromUrl);
            }
        }

        // Listen for hash changes (e.g., from another window or back/forward navigation)
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#doc_')) {
                const docIdFromUrl = hash.substring(1);
                console.log(`📍 Hash changed to: ${docIdFromUrl}`);
                setCurrentDocId(docIdFromUrl);
            } else if (hash === '' && currentDocId) {
                // Hash cleared - return to dashboard
                console.log(`📍 Hash cleared, returning to dashboard`);
                setCurrentDocId(null);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []); // Run only once on mount and listen for hash changes

    // Update URL hash when document changes
    useEffect(() => {
        if (currentDocId) {
            window.location.hash = currentDocId;
        } else {
            // Clear hash when returning to dashboard
            if (window.location.hash) {
                window.location.hash = '';
            }
        }
    }, [currentDocId]);

    // [Phase 7] Command Palette Keyboard Shortcut
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

    const handleStressTest = async () => {
        if (!secureNetwork) return;
        const results = await runPerformanceStressTest(secureNetwork, currentUser);
        alert(`📊 Stress Test Complete!\nAvg Latency: ${(results.transclusionLatency.reduce((a, b) => a + b, 0) / (results.transclusionLatency.length || 1)).toFixed(2)}ms\nRedaction Speed: ${results.redactionLatency.toFixed(2)}ms`);
    };

    const commandActions: CommandAction[] = [
        { id: 'new-doc', label: 'New Document', icon: '➕', category: 'Application', shortcut: '⌘N', onExecute: () => setShowInputModal(true) },
        { id: 'save-doc', label: 'Save Document', icon: '💾', category: 'Application', shortcut: '⌘S', onExecute: () => secureNetwork?.save() },
        { id: 'mode-draft', label: 'Switch to Drafting Mode', icon: '📝', category: 'Navigation', onExecute: () => setAppMode('draft') },
        { id: 'mode-audit', label: 'Switch to Audit Mode', icon: '🛡️', category: 'Governance', onExecute: () => setAppMode('audit') },
        { id: 'mode-presentation', label: 'Switch to Presentation Mode', icon: '📊', category: 'Presentation', onExecute: () => setAppMode('presentation') },
        { id: 'view-dashboard', label: 'Go to Dashboard', icon: '🏠', category: 'Navigation', onExecute: () => setCurrentDocId(null) },
        { id: 'show-marketplace', label: 'Open Marketplace', icon: '🛒', category: 'Application', onExecute: () => setShowMarketplace(true) },
        { id: 'stress-test', label: 'Run Performance Stress Test', icon: '🧪', category: 'Governance', onExecute: handleStressTest },
    ];

    // Initialize Document & Network
    useEffect(() => {
        if (!session || !currentDocId) return;

        const cDoc = new Y.Doc();
        setClientDoc(cDoc);

        const networkUser = {
            id: session.user.id,
            attributes: currentUser.attributes
        };

        const bridge = new TauriSecureNetwork(cDoc, networkUser, supabase, currentDocId);
        const awareness = bridge.getSyncProvider().awareness;
        awareness.setLocalStateField('user', {
            name: session.user.email || 'Anonymous',
            color: '#667eea'
        });

        setSecureNetwork(bridge);
        (window as any).tauriNetwork = bridge;

        return () => {
            cDoc.destroy();
        };
    }, [session, currentDocId]);

    // [Phase 6.5] Fetch Title when DocId changes
    useEffect(() => {
        if (!session || !currentDocId) {
            setCurrentDocTitle('');
            return;
        }

        const fetchTitle = async () => {
            const { data, error } = await supabase
                .from('documents')
                .select('title')
                .eq('id', currentDocId)
                .single();

            if (!error && data) {
                setCurrentDocTitle(data.title || 'Untitled Document');
            }
        };
        fetchTitle();
    }, [session, currentDocId]);

    // Update Network User when role changes
    useEffect(() => {
        if (secureNetwork) {
            secureNetwork.updateUser(currentUser);
            const awareness = secureNetwork.getSyncProvider().awareness;
            awareness.setLocalStateField('user', {
                name: `${currentUser.attributes.role} (You)`,
                color: currentUser.attributes.role === 'admin' ? '#ff4b2b' : '#667eea'
            });
        }
    }, [currentUser, secureNetwork]);

    // Awareness Listener
    useEffect(() => {
        if (!secureNetwork) return;
        const awareness = secureNetwork.getSyncProvider().awareness;
        const handleAwarenessChange = () => {
            setActiveUserCount(awareness.getStates().size);
        };
        awareness.on('change', handleAwarenessChange);
        return () => {
            awareness.off('change', handleAwarenessChange);
        };
    }, [secureNetwork]);

    // Auto-Save
    useEffect(() => {
        if (!clientDoc || !secureNetwork) return;
        let debounceInfo: any = null;
        const updateHandler = () => {
            if (debounceInfo) clearTimeout(debounceInfo);
            debounceInfo = setTimeout(() => {
                secureNetwork.save();
            }, 1000);
        };
        clientDoc.on('update', updateHandler);
        return () => {
            clientDoc.off('update', updateHandler);
            if (debounceInfo) clearTimeout(debounceInfo);
        };
    }, [clientDoc, secureNetwork]);

    // Auto-Mutate Loop
    useEffect(() => {
        if (!autoMutate || !clientDoc) return;
        const interval = setInterval(() => {
            clientDoc.transact(() => {
                const content = clientDoc.getArray('content');
                for (let i = 0; i < content.length; i++) {
                    const block = content.get(i) as any;
                    if (block.get('type') === 'variable') {
                        const data = block.get('data');
                        const val = data.get('value');
                        if (val.name === 'revenue') {
                            val.value = Math.floor(Math.random() * 500000);
                            data.set('value', val);
                        }
                    }
                }
            });
        }, 50);
        return () => clearInterval(interval);
    }, [autoMutate, clientDoc]);

    const injectMassiveData = () => {
        if (!clientDoc) return;
        const newBlocks: any[] = [];
        for (let i = 0; i < 1000; i++) {
            newBlocks.push({
                id: `perf-block-${i}-${Date.now()}`,
                type: 'paragraph',
                data: {
                    text: `Performance Test Block #${i} - ${Math.random().toString(36)}`,
                    metadata: { slideIndex: 3 + Math.floor(i / 10) }
                },
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            });
        }
        clientDoc.transact(() => {
            const content = clientDoc.getArray('content');
            content.insert(content.length, newBlocks as any);
        });
    };

    const handleImportBlock = (mBlock: MarketplaceBlock) => {
        if (!clientDoc || !secureNetwork) return;
        const blockId = generateUUID();
        const metadata: BlockMetadata = {
            ...mBlock.data.metadata,
            provenance: { authorId: mBlock.author, sourceId: mBlock.id, timestamp: new Date().toISOString() }
        };
        secureNetwork.getMetadataStore().set(blockId, metadata);
        const fragment = clientDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
        clientDoc.transact(() => {
            const nodeName = mBlock.type === 'heading1' ? 'heading' : 'paragraph';
            const newNode = new Y.XmlElement(nodeName);
            newNode.setAttribute('blockId', blockId);
            if (mBlock.type === 'heading1') newNode.setAttribute('level', '1');
            const textNode = new Y.XmlText(mBlock.data.text);
            newNode.insert(0, [textNode]);
            fragment.push([newNode]);
        });
        setShowMarketplace(false);
    };

    const insertGlobalTransclusion = () => {
        if (!clientDoc || !secureNetwork) return;
        const refId = 'ext-ref-' + Math.random().toString(36).substring(7);
        secureNetwork.getReferenceStore().addReference({
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

    const handleSave = async () => {
        if (!secureNetwork) return;
        setIsSaving(true);
        await secureNetwork.save();
        setTimeout(() => setIsSaving(false), 800);
    };

    if (!session) return <AuthPage supabase={supabase} />;
    if (!currentDocId) return <DocumentList supabase={supabase} user={session.user} onSelectDocument={setCurrentDocId} />;
    if (!clientDoc) return <div className="demo-app loading"><div className="loading-spinner"><h1>Loading...</h1></div></div>;

    return (
        <div className="demo-app">
            <PerformanceMonitor yDoc={clientDoc} />

            <AppHeader
                currentDocId={currentDocId}
                currentDocTitle={currentDocTitle}
                currentView={view}
                autoMutate={autoMutate}
                showMarketplace={showMarketplace}
                showMetadataPanel={showMetadataPanel}
                showHelp={showHelp}
                isSaving={isSaving}
                activeUserCount={activeUserCount}
                currentRole={currentUser.attributes.role}
                awareness={secureNetwork?.getSyncProvider().awareness}
                onBack={() => setCurrentDocId(null)}
                onViewChange={setView}
                onToggleAutoMutate={() => setAutoMutate(!autoMutate)}
                onInsertTransclusion={insertGlobalTransclusion}
                onInjectMassiveData={injectMassiveData}
                onRunStressTest={handleStressTest}
                onToggleMarketplace={() => setShowMarketplace(!showMarketplace)}
                onToggleMetadataPanel={() => setShowMetadataPanel(!showMetadataPanel)}
                onToggleHelp={() => setShowHelp(!showHelp)}
                onSave={handleSave}
                onRoleChange={(role) => setCurrentUser(USERS[role])}
                onShowCommandPalette={() => setShowCommandPalette(true)}
                onShowCreateModal={() => setShowInputModal(true)}
            />

            <div className={`demo-content view-${view}`}>
                {(view === 'split' || view === 'editor') && (
                    <EditorPanel
                        yDoc={clientDoc}
                        user={currentUser}
                        metadataStore={secureNetwork?.getMetadataStore() || null}
                        awareness={secureNetwork?.getSyncProvider().awareness || null}
                        editorView={editorView}
                        appMode={appMode}
                        onBlockSelect={setSelectedBlockId}
                        editorContainerRef={editorContainerRef}
                    />
                )}
                {(view === 'split' || view === 'slides') && (
                    <SlidesPanel yDoc={clientDoc} user={currentUser} />
                )}
                {view === 'governance' && secureNetwork && (
                    <div className="governance-panel">
                        <GovernanceDashboard network={secureNetwork} yDoc={clientDoc} />
                    </div>
                )}
                {showMetadataPanel && secureNetwork && (
                    <MetadataPanel
                        selectedBlockId={selectedBlockId}
                        metadataStore={secureNetwork.getMetadataStore()}
                        user={currentUser}
                        onClose={() => setShowMetadataPanel(false)}
                        onSave={() => secureNetwork.save()}
                    />
                )}
            </div>

            {showMarketplace && (
                <MarketplaceSidebar
                    onImportBlock={handleImportBlock}
                    onClose={() => setShowMarketplace(false)}
                />
            )}

            <footer className="demo-footer">
                <div className="status-indicator">
                    <span className="status-dot"></span>
                    <span>Tauri Secure File System Active</span>
                </div>
                <button
                    className="view-btn exit-btn"
                    onClick={() => { if (confirm('Sign out?')) supabase.auth.signOut(); }}
                >
                    Exit
                </button>
            </footer>

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
        </div>
    );
};
