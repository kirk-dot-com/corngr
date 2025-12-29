import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { MetadataStore } from '../metadata/MetadataStore';

/**
 * GutterPlugin: Adds contextual gutters to each block for governance actions.
 * Familiar to Notion/Linear users, adapted for Compliance/Audit personas.
 */
export function createGutterPlugin(
    metadataStore: MetadataStore,
    appMode: 'draft' | 'audit' | 'presentation'
): Plugin {
    return new Plugin({
        props: {
            decorations(state) {
                const decos: Decoration[] = [];

                state.doc.descendants((node, pos) => {
                    if (node.isBlock && node.attrs.blockId) {
                        const widget = Decoration.widget(pos, (view) => {
                            const dom = document.createElement('div');
                            dom.className = `block-gutter-wrapper ${appMode}-mode`;

                            const metadata = metadataStore.get(node.attrs.blockId);
                            const isSealed = !!metadata?.provenance?.signature;

                            if (appMode === 'audit') {
                                const indicator = document.createElement('span');
                                indicator.className = `audit-indicator ${isSealed ? 'status-sealed' : 'status-unsealed'}`;
                                indicator.innerHTML = isSealed ? '🛡️' : '⚪';
                                indicator.title = isSealed ? 'Block Sealed' : 'Draft / Unverified';
                                dom.appendChild(indicator);
                            } else if (appMode === 'draft') {
                                // Sign Button
                                const signBtn = document.createElement('button');
                                signBtn.className = `gutter-btn ${isSealed ? 'active' : ''}`;
                                signBtn.innerHTML = isSealed ? '🔒' : '🔏';
                                signBtn.title = isSealed ? 'Sealed Block (Click to verify)' : 'Sign & Seal Block';

                                signBtn.onclick = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    if (isSealed) {
                                        alert(`🛡️ BLOCK VERIFIED\nID: ${node.attrs.blockId}\nSigner: ${metadata?.provenance?.authorId || 'Unknown'}\nTimestamp: ${metadata?.provenance?.timestamp}`);
                                    } else {
                                        // Mock Signing Process
                                        const proceed = confirm('Sign this block with your Ed25519 identity? This will freeze the content in Audit Mode.');
                                        if (proceed) {
                                            const newMetadata = {
                                                ...metadata,
                                                provenance: {
                                                    ...metadata?.provenance,
                                                    signature: 'ED25519_SIG_' + Math.random().toString(36).substring(7),
                                                    authorId: 'Current User',
                                                    timestamp: new Date().toISOString()
                                                }
                                            };
                                            metadataStore.set(node.attrs.blockId, newMetadata as any);
                                            // The view will re-render decorations on next update
                                            view.dispatch(view.state.tr);
                                        }
                                    }
                                };
                                dom.appendChild(signBtn);

                                // View Source / Info
                                const infoBtn = document.createElement('button');
                                infoBtn.className = 'gutter-btn';
                                infoBtn.innerHTML = 'ℹ️';
                                infoBtn.title = 'View Block Lineage';
                                infoBtn.onclick = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    alert(`Block Lineage:\nID: ${node.attrs.blockId}\nType: ${node.type.name}\nProvenance: ${metadata?.provenance?.sourceId || 'Local'}`);
                                };
                                dom.appendChild(infoBtn);
                            }

                            return dom;
                        }, { side: -1, stopEvent: () => true });
                        decos.push(widget);
                    }
                    // We only want to add gutters to top-level blocks
                    return pos === 0;
                });

                return DecorationSet.create(state.doc, decos);
            }
        }
    });
}
