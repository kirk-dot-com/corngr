import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { ProseMirrorEditor } from './prosemirror/ProseMirrorEditor';
import { SlideRenderer } from './slides/SlideRenderer';
import { Toolbar } from './prosemirror/Toolbar';
import { MetadataPanel } from './components/MetadataPanel';
import { EditorView } from 'prosemirror-view';
import { User, Role } from './security/types';
import { TauriSecureNetwork } from './security/TauriSecureNetwork';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { MarketplaceSidebar, MarketplaceBlock } from './components/MarketplaceSidebar';
import { GovernanceDashboard } from './components/governance/GovernanceDashboard';
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
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config/SupabaseConfig';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



export const DemoApp: React.FC = () => {
    // Phase 6: Authentication State
    const [session, setSession] = useState<any>(null); // Supabase Session

    // Phase 1 Architecture:
    // Client Doc is the Single Source of Truth for the UI.
    // Syncs with Rust Backend via TauriSecureNetwork.
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

    // [Phase 6] Listen for Auth Changes
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('🔍 Initial Session Check:', session ? 'Found' : 'Null');
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            console.log(`🔔 Auth Event: ${event}`, session?.user?.id);
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Initialize Document & Network (Only if Session exists)
    useEffect(() => {
        if (!session) return;

        // 1. Create fresh Client Doc
        const cDoc = new Y.Doc();
        setClientDoc(cDoc);

        // 2. Initialize Bridge to Rust Backend
        // For Phase 6 demo, we map the real auth user to our demo "Admin" user attributes
        // In Phase 7, we will fetch real attributes from DB
        const networkUser = {
            id: session.user.id,
            attributes: currentUser.attributes // Keep role switching for demo purposes
        };

        console.log(`🔐 Initializing Secure Network for ${networkUser.attributes.role}`);
        const bridge = new TauriSecureNetwork(cDoc, networkUser);

        // Phase 3: Set initial awareness state
        const awareness = bridge.getSyncProvider().awareness;
        awareness.setLocalStateField('user', {
            name: session.user.email || 'Anonymous',
            color: '#667eea'
        });

        setSecureNetwork(bridge);

        // Phase 3: Expose network for NodeViews and Renderers
        (window as any).tauriNetwork = bridge;

        return () => {
            cDoc.destroy();
        };
    }, [session]);

    if (!session) {
        return <AuthPage supabase={supabase} />;
    }

    // Update Network User when role changes
    useEffect(() => {
        if (secureNetwork) {
            console.log(`🔄 Switching Secure Network Role to ${currentUser.attributes.role}`);
            secureNetwork.updateUser(currentUser);

            // Phase 3: Update local awareness identity
            const awareness = secureNetwork.getSyncProvider().awareness;
            awareness.setLocalStateField('user', {
                name: `${currentUser.attributes.role} (You)`,
                color: currentUser.attributes.role === 'admin' ? '#ff4b2b' : '#667eea'
            });
        }
    }, [currentUser, secureNetwork]);

    // Awareness Listener for Header & Cursors
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

    // Auto-Save: Listen for changes and push to Rust
    useEffect(() => {
        if (!clientDoc || !secureNetwork) return;

        let debounceInfo: any = null;

        const updateHandler = () => {
            // Debounce save
            if (debounceInfo) clearTimeout(debounceInfo);
            debounceInfo = setTimeout(() => {
                secureNetwork.save();
            }, 1000); // Auto-save after 1s of inactivity
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

        console.log('⚡ Starting High-Freq Mutation Loop');
        const interval = setInterval(() => {
            clientDoc.transact(() => {
                const content = clientDoc.getArray('content');
                // Naive: Update first variable we find
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
        }, 50); // 50ms interval

        return () => clearInterval(interval);
    }, [autoMutate, clientDoc]);

    // 1k Injector
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
        console.log('🚀 Injected 1000 blocks into Client Doc');
    };

    // Marketplace Integration
    const handleImportBlock = (mBlock: MarketplaceBlock) => {
        if (!clientDoc || !secureNetwork) return;

        const blockId = generateUUID();

        // 1. Register in MetadataStore (Governance)
        const metadata: BlockMetadata = {
            ...mBlock.data.metadata,
            provenance: {
                authorId: mBlock.author,
                sourceId: mBlock.id,
                timestamp: new Date().toISOString()
            }
        };
        secureNetwork.getMetadataStore().set(blockId, metadata);

        // 2. Insert into Editor (Content)
        const fragment = clientDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;

        clientDoc.transact(() => {
            const nodeName = mBlock.type === 'heading1' ? 'heading' : 'paragraph';
            const newNode = new Y.XmlElement(nodeName);

            // y-prosemirror expects attributes to be synced via Y.XmlElement attributes
            newNode.setAttribute('blockId', blockId);
            if (mBlock.type === 'heading1') {
                newNode.setAttribute('level', '1'); // attrs in schema.ts
            }

            const textNode = new Y.XmlText(mBlock.data.text);
            newNode.insert(0, [textNode]);

            fragment.push([newNode]);
        });

        console.log(`🎁 [Marketplace] Imported ${mBlock.title} (${blockId})`);
        setShowMarketplace(false);
    };

    // [Sprint 3] Global Transclusion Test
    const insertGlobalTransclusion = () => {
        if (!clientDoc || !secureNetwork) return;

        const refId = 'ext-ref-' + Math.random().toString(36).substring(7);

        // 1. Register a mock external reference in the store
        // In a real scenario, this would come from a picker or clipboard
        secureNetwork.getReferenceStore().addReference({
            id: refId,
            targetDocId: 'doc-alpha-99',
            targetBlockId: 'b3', // Confidential Block in mock data
            originUrl: 'https://security.corngr.com/vault/finance-2024.crng',
            lastVerified: new Date().toISOString(),
            status: 'active'
        });

        // 2. Insert the reference into the editor
        const fragment = clientDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
        clientDoc.transact(() => {
            const node = new Y.XmlElement('inline-reference');
            node.setAttribute('refId', refId);
            node.setAttribute('fallbackText', 'Resolving Finance Data...');
            fragment.push([node]);
        });

        console.log(`🌐 [Sprint 3] Inserted Global Transclusion: ${refId}`);
    };

    // [Sprint 4] Run Stress Test
    const handleStressTest = async () => {
        if (!secureNetwork) return;

        // 1. Insert some transclusions if none exist
        const refs = secureNetwork.getReferenceStore().listAll();
        if (refs.length === 0) {
            console.log('🔄 Seeding transclusions for test...');
            insertGlobalTransclusion();
            insertGlobalTransclusion();
        }

        // 2. Run Test
        const results = await runPerformanceStressTest(secureNetwork, currentUser);
        alert(`📊 Stress Test Complete!\nAvg Latency: ${(results.transclusionLatency.reduce((a, b) => a + b, 0) / (results.transclusionLatency.length || 1)).toFixed(2)}ms\nRedaction Speed: ${results.redactionLatency.toFixed(2)}ms`);
    };

    // Track editor view for toolbar
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

    if (!clientDoc) {
        return (
            <div className="demo-app loading">
                <div className="loading-spinner">
                    <h1>Loading Corngr...</h1>
                    <p>Connecting to Rust Secure Backend</p>
                </div>
            </div>
        );
    }

    return (
        <div className="demo-app">
            <PerformanceMonitor yDoc={clientDoc} />

            <header className="demo-header">
                <div className="header-content">
                    <h1>🌽 Corngr Phase 3</h1>
                    <p className="tagline">Ecosystem & Marketplace Integration</p>
                </div>

                <div className="view-controls">
                    <div style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Role:</span>
                        <select
                            value={currentUser.attributes.role}
                            onChange={async (e) => {
                                const newRole = e.target.value as Role;
                                if (secureNetwork) {
                                    console.log('🔄 Saving before role switch...');
                                    await secureNetwork.save();
                                }
                                setCurrentUser(USERS[newRole]);
                            }}
                            style={{ padding: '4px', borderRadius: '4px' }}
                        >
                            <option value="admin">👮 Admin</option>
                            <option value="editor">✏️ Editor</option>
                            <option value="viewer">👀 Viewer</option>
                        </select>
                        <button
                            className="view-btn warning"
                            style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#e53e3e' }}
                            onClick={() => supabase.auth.signOut()}
                        >
                            Sign Out
                        </button>
                    </div>

                    <button className={`view-btn ${view === 'split' ? 'active' : ''}`} onClick={() => setView('split')}>⚡ Dual View</button>
                    <button className={`view-btn ${view === 'editor' ? 'active' : ''}`} onClick={() => setView('editor')}>📝 Document</button>
                    <button className={`view-btn ${view === 'slides' ? 'active' : ''}`} onClick={() => setView('slides')}>📊 Slides</button>

                    <button
                        className={`view-btn ${showMarketplace ? 'active' : ''}`}
                        onClick={() => setShowMarketplace(!showMarketplace)}
                    >
                        🛒 Marketplace
                    </button>

                    <div className="active-users-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: '20px', margin: '0 8px', height: '32px' }}>
                        <div className="status-dot online"></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9d88ff' }}>Active: {activeUserCount}</span>
                    </div>

                    <button className={`view-btn ${view === 'governance' ? 'active' : ''}`} onClick={() => setView('governance')}>🛡️ Governance</button>

                    <button
                        className="view-btn"
                        onClick={insertGlobalTransclusion}
                        style={{ border: '1px dashed #667eea', color: '#667eea' }}
                    >
                        🌐 +Transclude
                    </button>

                    <button
                        className={`view-btn ${showMetadataPanel ? 'active' : ''}`}
                        onClick={() => setShowMetadataPanel(!showMetadataPanel)}
                        style={{ marginLeft: '12px', background: showMetadataPanel ? '#764ba2' : '#222' }}
                    >
                        🏷️ Metadata
                    </button>

                    <div style={{ width: '1px', height: '20px', background: '#444', margin: '0 8px' }}></div>

                    <button className="view-btn warning" onClick={injectMassiveData} style={{ fontSize: '0.8rem', background: '#e0b0ff', color: '#333' }}>🚀 1k Blocks</button>
                    <button className="view-btn warning" onClick={() => setAutoMutate(!autoMutate)} style={{ fontSize: '0.8rem', background: autoMutate ? '#0f0' : '#444', color: autoMutate ? '#000' : '#ccc' }}>⚡ Auto-Mutate</button>
                    <button className="view-btn" onClick={handleStressTest} style={{ fontSize: '0.8rem', background: '#3b82f6', color: 'white' }}>🧪 Stress Test</button>
                    <button className="view-btn" onClick={() => secureNetwork?.save()} style={{ fontSize: '0.8rem', background: '#222' }}>💾 Save</button>
                    <button className="view-btn warning" onClick={() => { if (confirm('Reset?')) secureNetwork?.reset(); }} style={{ fontSize: '0.8rem', background: '#f55', color: 'white' }}>🗑️ Reset</button>
                </div>
            </header>

            <div className={`demo-content view-${view}`}>
                {(view === 'split' || view === 'editor') && (
                    <div className="editor-panel">
                        <div className="panel-header">
                            <h2>Document View</h2>
                            <span className="tech-badge">ProseMirror + Yjs</span>
                        </div>
                        <Toolbar editorView={editorView} yDoc={clientDoc} />
                        <div ref={editorContainerRef}>
                            <ProseMirrorEditor
                                yDoc={clientDoc}
                                user={currentUser}
                                metadataStore={secureNetwork?.getMetadataStore() || null}
                                awareness={secureNetwork?.getSyncProvider().awareness || null}
                                onBlockSelect={setSelectedBlockId}
                                editorId="main-editor"
                            />
                        </div>
                    </div>
                )}

                {(view === 'split' || view === 'slides') && (
                    <div className="slides-panel">
                        <div className="panel-header">
                            <h2>Slide View</h2>
                            <span className="tech-badge">React + Yjs</span>
                        </div>
                        <SlideRenderer yDoc={clientDoc} user={currentUser} />
                    </div>
                )}

                {view === 'governance' && secureNetwork && (
                    <div className="governance-panel" style={{ flexGrow: 1 }}>
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
                    <span>Tauri File System Active</span>
                </div>
                <div className="footer-info">
                    <span>Phase 3: Ecosystem</span>
                    <span>•</span>
                    <span>Provenance Verified ⛓️</span>
                    <span>•</span>
                    <span>User: {currentUser.attributes.role}</span>
                </div>
            </footer>
        </div>
    );
};
