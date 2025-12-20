import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { MetadataStore } from '../metadata/MetadataStore';
import { User } from '../security/types';
import { checkClientAccess } from '../security/checkClientAccess';

/**
 * FilterPlugin for Phase 2
 * 
 * Purpose: Visually redact blocks in the ProseMirror editor based on security metadata.
 * It uses Decorations to overlap unauthorized content without deleting the actual nodes,
 * ensuring users only see what they have clearance for while maintaining the "Shadow Store" sync.
 */
export function createFilterPlugin(
    metadataStore: MetadataStore,
    user: User | null
): Plugin {
    return new Plugin({
        state: {
            init() {
                return DecorationSet.empty;
            },
            apply(tr, _oldState, _oldEditorState, newEditorState) {
                // We re-calculate decorations if the document changes
                // OR if we're forced to (e.g. on role switch, though PM state usually handles that via plugin props)
                if (tr.docChanged) {
                    return createDecorations(newEditorState.doc, metadataStore, user);
                }
                return _oldState.map(tr.mapping, tr.doc);
            }
        },
        props: {
            decorations(state) {
                // If user changes externally (e.g. role switch), we need to re-evaluate.
                // Re-calculating on every decoration call can be expensive, 
                // but for MVP it ensures immediate security feedback.
                return createDecorations(state.doc, metadataStore, user);
            },
            // Prevent interaction with redacted nodes
            handleDOMEvents: {
                mousedown: (view, event) => {
                    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                    if (pos) {
                        const node = view.state.doc.nodeAt(pos.pos);
                        if (node && node.attrs.blockId) {
                            const metadata = metadataStore.get(node.attrs.blockId);
                            if (!checkClientAccess(user, metadata)) {
                                event.preventDefault();
                                return true;
                            }
                        }
                    }
                    return false;
                }
            }
        }
    });
}

/**
 * Helper to scan document nodes and apply redaction decorations
 */
function createDecorations(doc: any, store: MetadataStore, user: User | null): DecorationSet {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
        // Only target block-level nodes that expected to have IDs (paragraphs, headings)
        if (node.isBlock && node.attrs.blockId) {
            const metadata = store.get(node.attrs.blockId);

            if (!checkClientAccess(user, metadata)) {
                // Apply a node decoration to the restricted block
                decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                        class: 'redacted-node',
                        'data-security': metadata?.classification || 'restricted',
                        'title': 'Restricted Content'
                    })
                );
            }
        }
        // Return true to keep descending, but typically we only care about top-level blocks in Corngr
        return true;
    });

    return DecorationSet.create(doc, decorations);
}
