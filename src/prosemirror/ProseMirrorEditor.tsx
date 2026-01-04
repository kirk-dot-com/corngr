import React, { useEffect, useRef, useState, useMemo } from 'react';
import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Awareness } from 'y-protocols/awareness';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { ySyncPlugin, yUndoPlugin, undo as yUndo, redo as yRedo } from 'y-prosemirror';
import * as Y from 'yjs';
import { corngrSchema, createSmartGrid } from './schema';
import { formatValue } from '../yjs/schema';
import { MetadataStore } from '../metadata/MetadataStore';
import { User } from '../security/types';
import { createFilterPlugin } from './FilterPlugin';
import { createGutterPlugin } from './GutterPlugin';
import { createBlockIdPlugin } from './BlockIdPlugin';
import { CollaboratorCursor } from '../components/collaboration/CollaboratorCursor';
import { SlashCommandMenu, CommandItem } from '../components/editor/SlashCommandMenu';
import { createSlashCommandPlugin } from '../components/editor/plugins/SlashCommandPlugin';
import { marketplaceStore } from '../stores/MarketplaceStore';
import { SmartGridComponent } from '../components/editor/SmartGridComponent';
import { useDocumentVerification } from '../hooks/useDocumentVerification';
import './editor.css';
import './cursor.css';

interface ProseMirrorEditorProps {
    yDoc: Y.Doc;
    user: User | null;
    metadataStore: MetadataStore | null;
    awareness?: Awareness | null;
    onBlockSelect?: (blockId: string | null) => void;
    onToast?: (message: string) => void;
    editorId?: string;
    appMode?: 'draft' | 'audit' | 'presentation';
}

export const ProseMirrorEditor: React.FC<ProseMirrorEditorProps> = ({
    yDoc,
    user,
    metadataStore,
    awareness,
    onBlockSelect,
    onToast,
    editorId = 'editor',
    appMode = 'draft'
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [currentView, setCurrentView] = useState<EditorView | null>(null);

    // Document Verification Hook
    useDocumentVerification(currentView, metadataStore);

    // Marketplace State
    const [installedCapabilities, setInstalledCapabilities] = useState<string[]>([]);

    useEffect(() => {
        // Subscribe to capability changes
        const updateCaps = () => {
            const caps: string[] = [];
            marketplaceStore.getProducts().forEach(p => {
                if (p.installed) caps.push(...p.capabilities);
            });
            setInstalledCapabilities(caps);
        };
        updateCaps();
        const unsubscribe = marketplaceStore.subscribe(updateCaps);
        return () => { unsubscribe(); };
    }, []);

    // Subscribe to verification events to refresh decorators
    useEffect(() => {
        if (!metadataStore || !currentView) return;

        const handleVerificationUpdate = () => {
            // Dispatch dummy transaction to force decoration update
            if (currentView && !currentView.isDestroyed) {
                const tr = currentView.state.tr.setMeta('verification', true);
                currentView.dispatch(tr);
            }
        };

        metadataStore.on('verification', handleVerificationUpdate);
        return () => {
            metadataStore.off('verification', handleVerificationUpdate);
        };
    }, [metadataStore, currentView]);

    // Slash Command State
    const [slashState, setSlashState] = useState<{
        active: boolean;
        query: string;
        coords: { top: number; left: number };
        range: { from: number; to: number };
        selectedIndex: number;
    }>({
        active: false,
        query: '',
        coords: { top: 0, left: 0 },
        range: { from: 0, to: 0 },
        selectedIndex: 0
    });

    // Define Commands
    const commands: CommandItem[] = useMemo(() => {
        const baseCommands: CommandItem[] = [
            {
                id: 'text',
                label: 'Text',
                icon: '📝',
                description: 'Just start writing with plain text.',
                action: (view) => {
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, corngrSchema.nodes.paragraph.create());
                    view.dispatch(tr);
                }
            },
            {
                id: 'h1',
                label: 'Heading 1',
                icon: 'H1',
                description: 'Big section heading.',
                action: (view) => {
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, corngrSchema.nodes.heading.create({ level: 1 }));
                    view.dispatch(tr);
                }
            },
            {
                id: 'h2',
                label: 'Heading 2',
                icon: 'H2',
                description: 'Medium section heading.',
                action: (view) => {
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, corngrSchema.nodes.heading.create({ level: 2 }));
                    view.dispatch(tr);
                }
            },
            {
                id: 'bullet_list',
                label: 'Bullet List',
                icon: '•',
                description: 'Create a simple bulleted list.',
                action: (view) => {
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, corngrSchema.nodes.bullet_list.create(null, corngrSchema.nodes.list_item.create(null, corngrSchema.nodes.paragraph.create())));
                    view.dispatch(tr);
                }
            },
            {
                id: 'code_block',
                label: 'Code Block',
                icon: '💻',
                description: 'Capture a code snippet.',
                action: (view) => {
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, corngrSchema.nodes.code_block.create());
                    view.dispatch(tr);
                }
            },
            {
                id: 'smart_grid',
                label: 'Smart Data Grid',
                icon: '📐',
                description: 'Embed an AI-powered spreadsheet.',
                action: (view) => {
                    const gridId = Math.random().toString(36).substr(2, 9);
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, createSmartGrid(gridId));
                    view.dispatch(tr);
                }
            }
        ];

        // Dynamic Commands based on Capabilities
        if (installedCapabilities.includes('block:symptom')) {
            baseCommands.push({
                id: 'symptom_triage',
                label: 'Details: Symptom Check',
                icon: '🩺',
                description: 'Insert a medical triage block.',
                action: (view) => {
                    // Start of Mock implementation
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, corngrSchema.nodes.paragraph.create(null, view.state.schema.text("Patient reports [SYMPTOM] duration [DURATION]...")));
                    view.dispatch(tr);
                }
            });
        }

        if (installedCapabilities.includes('block:clause')) {
            baseCommands.push({
                id: 'legal_clause',
                label: 'Legal: Liability Clause',
                icon: '⚖️',
                description: 'Insert standard liability wrapper.',
                action: (view) => {
                    const tr = view.state.tr.replaceWith(slashState.range.from, slashState.range.to, corngrSchema.nodes.code_block.create(null, view.state.schema.text("SECTION 5.1: LIMITATION OF LIABILITY\nThe Provider shall not be liable for...")));
                    view.dispatch(tr);
                }
            });
        }

        return baseCommands;
    }, [slashState.range, installedCapabilities]);

    // Filter commands
    const filteredCommands = useMemo(() => {
        return commands.filter(c => c.label.toLowerCase().includes(slashState.query.toLowerCase()));
    }, [commands, slashState.query]);

    // Ref to hold stable state for callbacks
    const stateRef = useRef({ slashState, filteredCommands });
    stateRef.current = { slashState, filteredCommands };

    function handleSlashKeyDown(event: KeyboardEvent): boolean {
        const { slashState, filteredCommands } = stateRef.current;
        const count = filteredCommands.length;

        if (event.key === 'ArrowUp') {
            const nextIndex = (slashState.selectedIndex + count - 1) % count;
            setSlashState(s => ({ ...s, selectedIndex: nextIndex }));
            return true;
        }
        if (event.key === 'ArrowDown') {
            const nextIndex = (slashState.selectedIndex + 1) % count;
            setSlashState(s => ({ ...s, selectedIndex: nextIndex }));
            return true;
        }
        if (event.key === 'Enter') {
            if (filteredCommands[slashState.selectedIndex]) {
                const cmd = filteredCommands[slashState.selectedIndex];
                if (viewRef.current) {
                    cmd.action(viewRef.current);
                }
            }
            return true;
        }
        if (event.key === 'Escape') {
            setSlashState(s => ({ ...s, active: false }));
            return true;
        }
        return false;
    }

    useEffect(() => {
        if (!editorRef.current) return;

        // Get or create the shared Yjs fragment
        const yXmlFragment = yDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;

        // Variable decoration plugin
        const variablePlugin = new Plugin({
            state: {
                init() { return null; },
                apply(_tr) { return null; }
            },
            view(editorView) {
                const content = yDoc.getArray('content');

                const updateVariables = () => {
                    const variables = new Map();
                    for (let i = 0; i < content.length; i++) {
                        const block = content.get(i) as Y.Map<any>;
                        if (block.get('type') === 'variable') {
                            const data = block.get('data') as Y.Map<any>;
                            const value = data.get('value');
                            if (value && value.name) {
                                variables.set(block.get('id'), {
                                    name: value.name,
                                    value: value.value,
                                    format: value.format
                                });
                            }
                        }
                    }

                    editorView.dom.querySelectorAll('span[data-variable]').forEach(el => {
                        const blockId = el.getAttribute('data-block-id');
                        if (blockId && variables.has(blockId)) {
                            const varData = variables.get(blockId);
                            const formatted = formatValue(varData.value, varData.format);
                            el.setAttribute('data-value', varData.value);
                            el.setAttribute('data-format', varData.format);
                            el.textContent = `{{${varData.name}}}`;
                            el.setAttribute('title', formatted);
                        }
                    });
                };

                content.observe(updateVariables);
                updateVariables();

                return {
                    destroy() {
                        content.unobserve(updateVariables);
                    }
                };
            }
        });

        const slashPlugin = createSlashCommandPlugin({
            onOpen: (query, range, coords) => {
                setSlashState(prev => ({ ...prev, active: true, query, range, coords, selectedIndex: 0 }));
            },
            onClose: () => {
                setSlashState(prev => ({ ...prev, active: false }));
            },
            onKeyDown: (event) => {
                return handleSlashKeyDown(event);
            }
        });

        const state = EditorState.create({
            schema: corngrSchema,
            plugins: [
                createBlockIdPlugin(),
                ySyncPlugin(yXmlFragment),
                yUndoPlugin(),
                variablePlugin,
                slashPlugin,
                ...(metadataStore && user ? [createFilterPlugin(metadataStore, user)] : []),
                ...(metadataStore ? [createGutterPlugin(metadataStore, appMode, onBlockSelect, onToast, user)] : []),
                history(),
                keymap({
                    'Mod-z': yUndo,
                    'Mod-y': yRedo,
                    'Mod-Shift-z': yRedo
                }),
                keymap(baseKeymap)
            ]
        });

        const view = new EditorView(editorRef.current, {
            state,
            attributes: {
                class: 'corngr-editor',
                'data-editor-id': editorId
            },
            nodeViews: {
                'inline-reference': (node, _view, _getPos) => {
                    const dom = document.createElement('span');
                    dom.className = 'corngr-inline-reference-mount';
                    const network = (window as any).tauriNetwork;
                    if (network) {
                        import('../components/TransclusionRenderer').then(({ TransclusionRenderer }) => {
                            import('react-dom/client').then(({ createRoot }) => {
                                const root = createRoot(dom);
                                root.render(
                                    <TransclusionRenderer
                                        network={network}
                                        refId={node.attrs.refId}
                                        fallbackText={node.attrs.fallbackText}
                                    />
                                );
                            });
                        });
                    }
                    return {
                        dom,
                        stopEvent: () => true,
                        ignoreMutation: () => true
                    };
                },
                'smart_grid': (node, _view, _getPos) => {
                    const dom = document.createElement('div');
                    dom.className = 'corngr-smart-grid-mount';
                    const gridId = node.attrs.gridId;

                    import('react-dom/client').then(({ createRoot }) => {
                        const root = createRoot(dom);
                        root.render(<SmartGridComponent gridId={gridId} yDoc={yDoc} />);
                    });

                    return {
                        dom,
                        stopEvent: () => true,
                        ignoreMutation: () => true
                    };
                }
            }
        });

        viewRef.current = view;
        setCurrentView(view);

        if (awareness) {
            const updateCursor = () => {
                const { selection } = view.state;
                awareness.setLocalStateField('cursor', {
                    anchor: selection.anchor,
                    head: selection.head
                });
            };
            updateCursor();
            const handleTransaction = () => {
                requestAnimationFrame(() => {
                    if (viewRef.current) {
                        const { selection } = viewRef.current.state;
                        awareness.setLocalStateField('cursor', {
                            anchor: selection.anchor,
                            head: selection.head
                        });
                    }
                });
            };
            view.dom.addEventListener('click', handleTransaction);
            view.dom.addEventListener('keyup', handleTransaction);
        }

        if (onBlockSelect) {
            const handleSelection = () => {
                const { selection } = view.state;
                if (selection.empty) {
                    onBlockSelect(null);
                    return;
                }
                const node = view.state.doc.nodeAt(selection.from);
                if (node && node.attrs.blockId) {
                    onBlockSelect(node.attrs.blockId);
                } else {
                    onBlockSelect(null);
                }
            };
            view.dom.addEventListener('mouseup', handleSelection);
        }

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [yDoc, editorId, user, metadataStore, onBlockSelect, appMode]);

    return (
        <div className={`prosemirror-editor-container ${appMode}-mode`}>
            <div ref={editorRef} className="prosemirror-editor" />

            {slashState.active && (
                <SlashCommandMenu
                    items={filteredCommands}
                    query={slashState.query}
                    coords={slashState.coords}
                    selectedIndex={slashState.selectedIndex}
                    onSelect={(item) => {
                        if (viewRef.current) item.action(viewRef.current);
                        setSlashState(prev => ({ ...prev, active: false }));
                    }}
                    onClose={() => setSlashState(prev => ({ ...prev, active: false }))}
                />
            )}

            {awareness && currentView && (
                <CollaboratorCursor
                    editorView={currentView}
                    awareness={awareness}
                    localClientId={awareness.clientID}
                />
            )}
        </div>
    );
};

export function getEditorView(container: HTMLElement): EditorView | null {
    const editorDiv = container.querySelector('.prosemirror-editor');
    if (!editorDiv) return null;
    return (editorDiv as any).editorView || null;
}
