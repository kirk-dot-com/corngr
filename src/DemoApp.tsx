import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { ProseMirrorEditor } from './prosemirror/ProseMirrorEditor';
import { SlideRenderer } from './slides/SlideRenderer';
import { Toolbar } from './prosemirror/Toolbar';
import { EditorView } from 'prosemirror-view';
import { User, Role } from './security/types';
import { TauriSecureNetwork } from './security/TauriSecureNetwork';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import './DemoApp.css';

// Mock Users
const USERS: Record<Role, User> = {
    admin: { id: 'u1', attributes: { role: 'admin', department: 'IT' } },
    editor: { id: 'u2', attributes: { role: 'editor', department: 'Sales' } },
    viewer: { id: 'u3', attributes: { role: 'viewer', department: 'Marketing' } }
};

export const DemoApp: React.FC = () => {
    // Phase 1 Architecture:
    // Client Doc is the Single Source of Truth for the UI.
    // Syncs with Rust Backend via TauriSecureNetwork.
    const [clientDoc, setClientDoc] = useState<Y.Doc | null>(null);

    const [view, setView] = useState<'split' | 'editor' | 'slides'>('split');
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [editorView, setEditorView] = useState<EditorView | null>(null);
    const [secureNetwork, setSecureNetwork] = useState<TauriSecureNetwork | null>(null);

    // Security State
    const [currentUser, setCurrentUser] = useState<User>(USERS.admin);

    // Performance Testing State
    const [autoMutate, setAutoMutate] = useState(false);

    // Initialize Document & Network
    useEffect(() => {
        // 1. Create fresh Client Doc
        const cDoc = new Y.Doc();
        setClientDoc(cDoc);

        // 2. Initialize Bridge to Rust Backend
        console.log(`🔐 Initializing Secure Network for ${currentUser.attributes.role}`);
        const bridge = new TauriSecureNetwork(cDoc, currentUser);
        setSecureNetwork(bridge);

        return () => {
            cDoc.destroy();
        };
    }, []);

    // Update Network User when role changes
    useEffect(() => {
        if (secureNetwork) {
            console.log(`🔄 Switching Secure Network Role to ${currentUser.attributes.role}`);
            secureNetwork.updateUser(currentUser);
        }
    }, [currentUser, secureNetwork]);

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
            {/* Render Performance Monitor tracking the Client (Rendered) Doc */}
            <PerformanceMonitor yDoc={clientDoc} />

            <header className="demo-header">
                <div className="header-content">
                    <h1>🌽 Corngr Phase 1: MVP</h1>
                    <p className="tagline">Local-First Secure Engine (Rust + Tauri)</p>
                </div>

                <div className="view-controls">
                    {/* Role Switcher */}
                    <div style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Role:</span>
                        <select
                            value={currentUser.attributes.role}
                            onChange={async (e) => {
                                // Force save before switching to prevent data loss
                                if (secureNetwork) {
                                    console.log('🔄 Saving before role switch...');
                                    await secureNetwork.save();
                                }
                                setCurrentUser(USERS[e.target.value as Role]);
                            }}
                            style={{ padding: '4px', borderRadius: '4px' }}
                        >
                            <option value="admin">👮 Admin</option>
                            <option value="editor">✏️ Editor</option>
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

                    <button
                        className="view-btn"
                        onClick={() => secureNetwork?.save()}
                        style={{ fontSize: '0.8rem', background: '#222' }}
                        title="Force Save"
                    >
                        💾 Save
                    </button>
                    <button
                        className="view-btn warning"
                        onClick={() => {
                            if (confirm('Are you sure? This will DELETE all local data and restore the Mock Security Test Data.')) {
                                secureNetwork?.reset();
                            }
                        }}
                        style={{ fontSize: '0.8rem', background: '#f55', color: 'white' }}
                        title="Reset to Mock Data"
                    >
                        🗑️ Reset
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
                        {/* EDITOR uses CLIENT DOC */}
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
                        {/* SLIDES use CLIENT DOC */}
                        <SlideRenderer yDoc={clientDoc} user={currentUser} />
                    </div>
                )}
            </div>

            <footer className="demo-footer">
                <div className="status-indicator">
                    <span className="status-dot"></span>
                    <span>Tauri File System Active</span>
                </div>
                <div className="footer-info">
                    <span>Phase 1: Core Product</span>
                    <span>•</span>
                    <span>Rust ABAC Security 🔒</span>
                    <span>•</span>
                    <span>User: {currentUser.attributes.role}</span>
                </div>
            </footer>
        </div>
    );
};
