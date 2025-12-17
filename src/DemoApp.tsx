import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { ProseMirrorEditor } from './prosemirror/ProseMirrorEditor';
import { SlideRenderer } from './slides/SlideRenderer';
import { Toolbar } from './prosemirror/Toolbar';
import { createCorngrDoc, createBlock, createVariableBlock } from './yjs/schema';
import { EditorView } from 'prosemirror-view';
import { User, Role } from './security/types';
import { MockSecureNetwork } from './security/MockSecureNetwork';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import './DemoApp.css';

const DEMO_DOC_ID = 'corngr-demo-doc';

// Mock Users
const USERS: Record<Role, User> = {
    admin: { id: 'u1', attributes: { role: 'admin', department: 'IT' } },
    editor: { id: 'u2', attributes: { role: 'editor', department: 'Sales' } },
    viewer: { id: 'u3', attributes: { role: 'viewer', department: 'Marketing' } }
};

export const DemoApp: React.FC = () => {
    // We now have TWO docs: Server (Source of Truth) and Client (Filtered View)
    const [serverDoc, setServerDoc] = useState<Y.Doc | null>(null);
    const [clientDoc, setClientDoc] = useState<Y.Doc | null>(null);

    const [persistence, setPersistence] = useState<IndexeddbPersistence | null>(null);
    const [view, setView] = useState<'split' | 'editor' | 'slides'>('split');
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [editorView, setEditorView] = useState<EditorView | null>(null);
    const [secureNetwork, setSecureNetwork] = useState<MockSecureNetwork | null>(null);

    // Security State
    const [currentUser, setCurrentUser] = useState<User>(USERS.admin);

    // Performance Testing State
    const [autoMutate, setAutoMutate] = useState(false);

    // Initialize Server Document (Source of Truth)
    useEffect(() => {
        const sDoc = new Y.Doc();
        const provider = new IndexeddbPersistence(DEMO_DOC_ID, sDoc);

        provider.on('synced', () => {
            console.log('📦 Server Document synced with IndexedDB');

            // Initialize with demo content if empty
            const content = sDoc.getArray('content');
            if (content.length === 0) {
                console.log('🎬 Creating demo content...');

                // Initialize doc metadata
                const meta = sDoc.getMap('meta');
                if (!meta.get('id')) {
                    meta.set('id', 'demo-doc-001');
                    meta.set('title', 'Corngr Phase 0 Demo');
                }

                // Slide 1: Title
                createBlock(sDoc, 'heading1', {
                    text: 'Corngr Phase 0',
                    metadata: { slideIndex: 0 }
                });
                createBlock(sDoc, 'heading2', {
                    text: 'The Post-File Operating System',
                    metadata: { slideIndex: 0 }
                });

                // Slide 2: The Problem
                createBlock(sDoc, 'heading1', {
                    text: 'The Problem',
                    metadata: { slideIndex: 1 }
                });
                createBlock(sDoc, 'paragraph', {
                    text: 'Traditional office suites trap data in static files (.docx, .xlsx, .pptx)',
                    metadata: { slideIndex: 1 }
                });
                createBlock(sDoc, 'paragraph', {
                    text: 'Copy-paste creates version conflicts and breaks governance',
                    metadata: { slideIndex: 1 }
                });

                // SECRET BLOCK
                createBlock(sDoc, 'heading2', {
                    text: '🔒 TOP SECRET ADMIN DATA',
                    metadata: { slideIndex: 1, acl: ['admin'] }
                });

                // Slide 3: The Solution with Variable
                createBlock(sDoc, 'heading1', {
                    text: 'The Solution',
                    metadata: { slideIndex: 2 }
                });
                createBlock(sDoc, 'paragraph', {
                    text: 'Unified Data Grid powered by Yjs CRDTs',
                    metadata: { slideIndex: 2 }
                });
                createVariableBlock(sDoc, 'revenue', 150000, 'currency');

                createBlock(sDoc, 'paragraph', {
                    text: 'Update once, update everywhere - in milliseconds',
                    metadata: { slideIndex: 2 }
                });

                console.log('✅ Demo content created');
            }
        });

        setServerDoc(sDoc);
        setPersistence(provider);

        // Client Doc (Ephemeral, usually would come from WebSocket)
        const cDoc = new Y.Doc();
        setClientDoc(cDoc);

        return () => {
            provider.destroy();
            sDoc.destroy();
            cDoc.destroy();
        };
    }, []);

    // Initialize/Update Secure Network Bridge
    useEffect(() => {
        if (serverDoc && clientDoc) {
            console.log(`🔐 Initializing Secure Network for ${currentUser.attributes.role}`);
            const bridge = new MockSecureNetwork(serverDoc, clientDoc, currentUser);
            setSecureNetwork(bridge);
        }
    }, [serverDoc, clientDoc]);

    // Update Network User when role changes
    useEffect(() => {
        if (secureNetwork) {
            console.log(`🔄 Switching Secure Network Role to ${currentUser.attributes.role}`);
            secureNetwork.updateUser(currentUser);
        }
    }, [currentUser, secureNetwork]);

    // Auto-Mutate Loop
    useEffect(() => {
        if (!autoMutate || !serverDoc) return;

        console.log('⚡ Starting High-Freq Mutation Loop');
        const interval = setInterval(() => {
            serverDoc.transact(() => {
                const content = serverDoc.getArray('content');
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
        }, 50); // 50ms interval = 20fps updates

        return () => clearInterval(interval);
    }, [autoMutate, serverDoc]);

    // 1k Injector
    const injectMassiveData = () => {
        if (!serverDoc) return;

        const newBlocks = [];
        for (let i = 0; i < 1000; i++) {
            newBlocks.push({
                id: `perf-block-${i}-${Date.now()}`,
                type: 'paragraph',
                data: {
                    text: `Performance Test Block #${i} - ${Math.random().toString(36)}`,
                    metadata: { slideIndex: 3 + Math.floor(i / 10) } // Start after slide 3, 10 blocks per slide
                },
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            });
        }

        serverDoc.transact(() => {
            const content = serverDoc.getArray('content');
            content.insert(content.length, newBlocks as any);
        });
        console.log('🚀 Injected 1000 blocks');
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

    if (!serverDoc || !clientDoc) {
        return (
            <div className="demo-app loading">
                <div className="loading-spinner">
                    <h1>Loading Corngr...</h1>
                    <p>Initializing unified data grid</p>
                </div>
            </div>
        );
    }

    return (
        <div className="demo-app">
            {/* Render Performance Monitor tracking the Client (Rendered) Doc */}
            <PerformanceMonitor yDoc={clientDoc} />

            <header className="demo-header">
                <div className="header-content">
                    <h1>🌽 Corngr Phase 0</h1>
                    <p className="tagline">Post-File Operating System Demo</p>
                </div>

                <div className="view-controls">
                    {/* Role Switcher */}
                    <div style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Role:</span>
                        <select
                            value={currentUser.attributes.role}
                            onChange={(e) => setCurrentUser(USERS[e.target.value as Role])}
                            style={{ padding: '4px', borderRadius: '4px' }}
                        >
                            <option value="admin">👮 Admin</option>
                            <option value="viewer">👀 Viewer</option>
                        </select>
                    </div>

                    <button
                        className={`view-btn ${view === 'split' ? 'active' : ''}`}
                        onClick={() => setView('split')}
                    >
                        ⚡ Dual View
                    </button>
                    <button
                        className={`view-btn ${view === 'editor' ? 'active' : ''}`}
                        onClick={() => setView('editor')}
                    >
                        📝 Document
                    </button>
                    <button
                        className={`view-btn ${view === 'slides' ? 'active' : ''}`}
                        onClick={() => setView('slides')}
                    >
                        📊 Slides
                    </button>

                    <div style={{ width: '1px', height: '20px', background: '#444', margin: '0 8px' }}></div>

                    <button
                        className="view-btn warning"
                        onClick={injectMassiveData}
                        style={{ fontSize: '0.8rem', background: '#e0b0ff', color: '#333' }}
                        title="Inject 1000 blocks"
                    >
                        🚀 1k Blocks
                    </button>

                    <button
                        className={`view-btn warning ${autoMutate ? 'active' : ''}`}
                        onClick={() => setAutoMutate(!autoMutate)}
                        style={{ fontSize: '0.8rem', background: autoMutate ? '#0f0' : '#444', color: autoMutate ? '#000' : '#ccc' }}
                        title="Toggle 50ms Updates"
                    >
                        ⚡ Auto-Mutate
                    </button>
                </div>
            </header>

            <div className={`demo-content view-${view}`}>
                {(view === 'split' || view === 'editor') && (
                    <div className="editor-panel">
                        <div className="panel-header">
                            <h2>Document View</h2>
                            <span className="tech-badge">ProseMirror + Yjs</span>
                        </div>
                        {/* EDITOR uses CLIENT DOC (Filtered) */}
                        <Toolbar editorView={editorView} yDoc={clientDoc} />
                        <div ref={editorContainerRef}>
                            <ProseMirrorEditor yDoc={clientDoc} editorId="main-editor" />
                        </div>
                    </div>
                )}

                {(view === 'split' || view === 'slides') && (
                    <div className="slides-panel">
                        <div className="panel-header">
                            <h2>Slide View</h2>
                            <span className="tech-badge">React + Yjs</span>
                        </div>
                        {/* SLIDES use CLIENT DOC (Filtered) */}
                        <SlideRenderer yDoc={clientDoc} user={currentUser} />
                    </div>
                )}
            </div>

            <footer className="demo-footer">
                <div className="status-indicator">
                    <span className="status-dot"></span>
                    <span>Live Sync Active</span>
                </div>
                <div className="footer-info">
                    <span>Phase 0: Technical Validation</span>
                    <span>•</span>
                    <span>Secure Filtering Active 🔒</span>
                    <span>•</span>
                    <span>User: {currentUser.attributes.role}</span>
                </div>
            </footer>
        </div>
    );
};
