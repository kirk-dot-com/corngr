import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Awareness } from 'y-protocols/awareness';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo as yUndo, redo as yRedo } from 'y-prosemirror';
import * as Y from 'yjs';
import { corngrSchema } from './schema';
import { formatValue } from '../yjs/schema';
import { MetadataStore } from '../metadata/MetadataStore';
import { User } from '../security/types';
import { createFilterPlugin } from './FilterPlugin';
import { createGutterPlugin } from './GutterPlugin';
import { createBlockIdPlugin } from './BlockIdPlugin';
import { CollaboratorCursor } from '../components/collaboration/CollaboratorCursor';
import './editor.css';

interface ProseMirrorEditorProps {
    yDoc: Y.Doc;
    user: User | null;
    metadataStore: MetadataStore | null;
    awareness?: Awareness | null;
    onBlockSelect?: (blockId: string | null) => void;
    editorId?: string;
    appMode?: 'draft' | 'audit' | 'presentation';
}

/**
 * ProseMirror editor component bound to Yjs
 */
export const ProseMirrorEditor: React.FC<ProseMirrorEditorProps> = ({
    yDoc,
    user,
    metadataStore,
    awareness,
    onBlockSelect,
    editorId = 'editor',
    appMode = 'draft'
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [currentView, setCurrentView] = useState<EditorView | null>(null);

    useEffect(() => {
        if (!editorRef.current) return;

        // Get or create the shared Yjs fragment
        const yXmlFragment = yDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;

        // Variable decoration plugin - updates variable displays when values change
        const variablePlugin = new Plugin({
            state: {
                init() {
                    return null;
                },
                apply(_tr) {
                    return null;
                }
            },
            view(editorView) {
                // Listen to content array changes to update variable values
                const content = yDoc.getArray('content');

                const updateVariables = () => {
                    // Get all variable blocks from Yjs
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

                    // Update the DOM directly for variable nodes
                    editorView.dom.querySelectorAll('span[data-variable]').forEach(el => {
                        const blockId = el.getAttribute('data-block-id');
                        if (blockId && variables.has(blockId)) {
                            const varData = variables.get(blockId);
                            const formatted = formatValue(varData.value, varData.format);

                            // Update attributes
                            el.setAttribute('data-value', varData.value);
                            el.setAttribute('data-format', varData.format);

                            // Update displayed text
                            el.textContent = `{{${varData.name}}}`;

                            // Add tooltip with actual value
                            el.setAttribute('title', formatted);
                        }
                    });
                };

                content.observe(updateVariables);
                updateVariables(); // Initial update

                return {
                    destroy() {
                        content.unobserve(updateVariables);
                    }
                };
            }
        });

        // Create editor state
        const state = EditorState.create({
            schema: corngrSchema,
            plugins: [
                createBlockIdPlugin(), // Must come before ySyncPlugin to ensure IDs are assigned before sync
                ySyncPlugin(yXmlFragment),
                ...(awareness ? [yCursorPlugin(awareness)] : []),
                yUndoPlugin(),
                variablePlugin,
                ...(metadataStore && user ? [createFilterPlugin(metadataStore, user)] : []),
                ...(metadataStore ? [createGutterPlugin(metadataStore, appMode)] : []),
                history(),
                keymap({
                    'Mod-z': yUndo,
                    'Mod-y': yRedo,
                    'Mod-Shift-z': yRedo
                }),
                keymap(baseKeymap)
            ]
        });

        // Create editor view
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

                    // We need the network to resolve references
                    // This is a bit tricky as network is in DemoApp
                    // But we can assume the component tree has access or pass it via props
                    // FOR NOW: We'll look for it in the window or use a global (Phase 3 strategy)
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
                }
            }
        });

        viewRef.current = view;
        setCurrentView(view);

        // Phase 6: Cursor tracking for collaboration
        // Use transaction listener instead of dynamic plugin to avoid y-prosemirror conflicts
        if (awareness) {
            const updateCursor = () => {
                const { selection } = view.state;
                awareness.setLocalStateField('cursor', {
                    anchor: selection.anchor,
                    head: selection.head
                });
            };

            // Initial cursor position
            updateCursor();

            // Listen to editor updates (this is safe and doesn't conflict with y-prosemirror)
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

            // Add DOM event listener for clicks and selections
            view.dom.addEventListener('click', handleTransaction);
            view.dom.addEventListener('keyup', handleTransaction);
        }

        // Phase 2.3: Selection tracking for MetadataPanel
        // Use DOM event listener instead of setProps to avoid breaking y-prosemirror
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

            // Add direct DOM event listener instead of using setProps
            view.dom.addEventListener('mouseup', handleSelection);
        }

        // Cleanup
        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [yDoc, editorId, user, metadataStore, onBlockSelect, appMode]);

    return (
        <div className={`prosemirror-editor-container ${appMode}-mode`}>
            <div ref={editorRef} className="prosemirror-editor" />
            {/* Phase 6: Cursor overlays for remote collaborators */}
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

/**
 * Get the current EditorView instance (for testing/debugging)
 */
export function getEditorView(container: HTMLElement): EditorView | null {
    const editorDiv = container.querySelector('.prosemirror-editor');
    if (!editorDiv) return null;

    // EditorView stores reference on DOM element
    return (editorDiv as any).editorView || null;
}
