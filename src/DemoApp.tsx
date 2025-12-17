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
                    meta.set('owner', 'demo-user');
                    meta.set('created', new Date().toISOString());
                    meta.set('modified', new Date().toISOString());
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

            return () => {
                // Cleanup if needed
            };
        }
    }, [serverDoc, clientDoc]); // Re-init if docs change (only once really)

    // Update Network User when role changes
    useEffect(() => {
        if (secureNetwork) {
            console.log(`🔄 Switching Secure Network Role to ${currentUser.attributes.role}`);
            secureNetwork.updateUser(currentUser);
        }
    }, [currentUser, secureNetwork]);


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
    }, [clientDoc, view]); // Dependent on clientDoc now!

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

                    <button
                        className="view-btn warning"
                        onClick={() => {
                            // Create restricted block in SERVER DOC
                            createBlock(serverDoc, 'heading2', {
                                text: '🔒 TOP SECRET ADMIN DATA',
                                metadata: {
                                    slideIndex: 1,
                                    acl: ['admin']
                                }
                            });
                        }}
                        style={{ marginLeft: 'auto', background: '#ff4444', fontSize: '0.8rem' }}
                    >
                        + Secret Block
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
