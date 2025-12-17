import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { ProseMirrorEditor } from './prosemirror/ProseMirrorEditor';
import { SlideRenderer } from './slides/SlideRenderer';
import { Toolbar } from './prosemirror/Toolbar';
import { createCorngrDoc, createBlock, createVariableBlock } from './yjs/schema';
import { EditorView } from 'prosemirror-view';
import { User, Role } from './security/types';
import './DemoApp.css';

const DEMO_DOC_ID = 'corngr-demo-doc';

// Mock Users
const USERS: Record<Role, User> = {
    admin: { id: 'u1', attributes: { role: 'admin', department: 'IT' } },
    editor: { id: 'u2', attributes: { role: 'editor', department: 'Sales' } },
    viewer: { id: 'u3', attributes: { role: 'viewer', department: 'Marketing' } }
};

export const DemoApp: React.FC = () => {
    const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
    const [persistence, setPersistence] = useState<IndexeddbPersistence | null>(null);
    const [view, setView] = useState<'split' | 'editor' | 'slides'>('split');
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [editorView, setEditorView] = useState<EditorView | null>(null);

    // Security State
    const [currentUser, setCurrentUser] = useState<User>(USERS.admin);

    // Initialize Yjs document and persistence
    useEffect(() => {
        const doc = new Y.Doc();
        const provider = new IndexeddbPersistence(DEMO_DOC_ID, doc);

        provider.on('synced', () => {
            console.log('📦 Document synced with IndexedDB');

            // Initialize with demo content if empty
            const content = doc.getArray('content');
            if (content.length === 0) {
                console.log('🎬 Creating demo content...');

                // Initialize doc metadata
                const meta = doc.getMap('meta');
                if (!meta.get('id')) {
                    meta.set('id', 'demo-doc-001');
                    meta.set('title', 'Corngr Phase 0 Demo');
                    meta.set('owner', 'demo-user');
                    meta.set('created', new Date().toISOString());
                    meta.set('modified', new Date().toISOString());
                }

                // Slide 1: Title
                createBlock(doc, 'heading1', {
                    text: 'Corngr Phase 0',
                    metadata: { slideIndex: 0 }
                });
                createBlock(doc, 'heading2', {
                    text: 'The Post-File Operating System',
                    metadata: { slideIndex: 0 }
                });

                // Slide 2: The Problem
                createBlock(doc, 'heading1', {
                    text: 'The Problem',
                    metadata: { slideIndex: 1 }
                });
                createBlock(doc, 'paragraph', {
                    text: 'Traditional office suites trap data in static files (.docx, .xlsx, .pptx)',
                    metadata: { slideIndex: 1 }
                });
                createBlock(doc, 'paragraph', {
                    text: 'Copy-paste creates version conflicts and breaks governance',
                    metadata: { slideIndex: 1 }
                });

                // Slide 3: The Solution with Variable
                createBlock(doc, 'heading1', {
                    text: 'The Solution',
                    metadata: { slideIndex: 2 }
                });
                createBlock(doc, 'paragraph', {
                    text: 'Unified Data Grid powered by Yjs CRDTs',
                    metadata: { slideIndex: 2 }
                });

                // Create a variable to demonstrate transclusion
                createVariableBlock(doc, 'revenue', 150000, 'currency');

                createBlock(doc, 'paragraph', {
                    text: 'Update once, update everywhere - in milliseconds',
                    metadata: { slideIndex: 2 }
                });

                console.log('✅ Demo content created');
            }
        });

        setYDoc(doc);
        setPersistence(provider);

        return () => {
            provider.destroy();
        };
    }, []);

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
    }, [yDoc, view]);

    if (!yDoc) {
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
                            // Create restricted block
                            createBlock(yDoc, 'heading2', {
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
                        <Toolbar editorView={editorView} yDoc={yDoc} />
                        <div ref={editorContainerRef}>
                            <ProseMirrorEditor yDoc={yDoc} editorId="main-editor" />
                        </div>
                    </div>
                )}

                {(view === 'split' || view === 'slides') && (
                    <div className="slides-panel">
                        <div className="panel-header">
                            <h2>Slide View</h2>
                            <span className="tech-badge">React + Yjs</span>
                        </div>
                        <SlideRenderer yDoc={yDoc} user={currentUser} />
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
                    <span>Current User: {currentUser.attributes.role}</span>
                </div>
            </footer>
        </div>
    );
};
