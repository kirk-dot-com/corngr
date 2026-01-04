import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { MetadataStore } from '../metadata/MetadataStore';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfirmModal } from '../components/ConfirmModal';

/**
 * Shows a modal dialog using React ConfirmModal component
 * Returns a Promise that resolves when user confirms or cancels
 */
function showModal(title: string, message: string, showCancel: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
        // Create a mount point for the modal
        const modalRoot = document.createElement('div');
        modalRoot.id = 'gutter-modal-root';
        document.body.appendChild(modalRoot);

        const root = ReactDOM.createRoot(modalRoot);

        const handleClose = (confirmed: boolean) => {
            root.unmount();
            document.body.removeChild(modalRoot);
            resolve(confirmed);
        };

        root.render(
            React.createElement(ConfirmModal, {
                isOpen: true,
                title,
                message,
                confirmLabel: showCancel ? 'Sign & Seal' : 'OK',
                showCancel,
                onConfirm: () => handleClose(true),
                onCancel: () => handleClose(false)
            })
        );
    });
}

/**
 * GutterPlugin: Adds contextual gutters to each block for governance actions.
 * Familiar to Notion/Linear users, adapted for Compliance/Audit personas.
 */
export function createGutterPlugin(
    metadataStore: MetadataStore,
    appMode: 'draft' | 'audit' | 'presentation',
    onBlockSelect?: (blockId: string | null) => void
): Plugin {
    return new Plugin({
        props: {
            decorations(state) {
                const decos: Decoration[] = [];

                state.doc.descendants((node, pos) => {
                    // Show gutters on paragraph and heading blocks, even without blockId
                    const isGutterableBlock = node.isBlock && (node.type.name === 'paragraph' || node.type.name === 'heading');
                    if (isGutterableBlock) {
                        // Use blockId if available, otherwise use position as temporary identifier
                        const blockIdentifier = node.attrs.blockId || `pos-${pos}`;

                        const widget = Decoration.widget(pos, (view) => {
                            const dom = document.createElement('div');
                            dom.className = `block-gutter-wrapper ${appMode}-mode`;

                            const metadata = node.attrs.blockId ? metadataStore.get(node.attrs.blockId) : null;
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

                                signBtn.onclick = async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Optimize: Instant Sign & Seal (Optimistic UI)
                                    // Remove confirmation modal for better "flow"
                                    if (isSealed) {
                                        // View Verification Details (keep modal for details)
                                        await showModal(
                                            '🛡️ Block Verified',
                                            `ID: ${blockIdentifier}\nSigner: ${metadata?.provenance?.authorId || 'Unknown'}\nTimestamp: ${metadata?.provenance?.timestamp}`
                                        );
                                    } else {
                                        // Instant Sign Action
                                        const newMetadata = {
                                            ...metadata,
                                            provenance: {
                                                ...metadata?.provenance,
                                                signature: 'ED25519_SIG_' + Math.random().toString(36).substring(7),
                                                authorId: 'Current User', // TODO: Get name from context
                                                timestamp: new Date().toISOString()
                                            }
                                        };
                                        if (node.attrs.blockId) {
                                            metadataStore.set(node.attrs.blockId, newMetadata as any);

                                            // Visual feedback (optional: could add a toast here if we had a toast system)
                                            console.log(`Block ${node.attrs.blockId} signed & sealed.`);
                                        }
                                        // The view will re-render decorations on next update
                                        view.dispatch(view.state.tr);
                                    }
                                };
                                dom.appendChild(signBtn);

                                // View Source / Info
                                const infoBtn = document.createElement('button');
                                infoBtn.className = 'gutter-btn info-btn';
                                infoBtn.innerHTML = 'ℹ️';
                                infoBtn.title = 'View Block Metadata';
                                infoBtn.onclick = async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Open metadata panel if callback is provided
                                    if (onBlockSelect && node.attrs.blockId) {
                                        onBlockSelect(node.attrs.blockId);
                                    } else {
                                        // Fallback to modal if no callback
                                        await showModal(
                                            'ℹ️ Block Lineage',
                                            `ID: ${blockIdentifier}\nType: ${node.type.name}\nProvenance: ${metadata?.provenance?.sourceId || 'Local'}`
                                        );
                                    }
                                };
                                dom.appendChild(infoBtn);
                            }

                            return dom;
                        }, { side: -1, stopEvent: () => true });
                        decos.push(widget);
                    }
                    // Don't descend into child nodes - we only want top-level block gutters
                    return false;
                });

                return DecorationSet.create(state.doc, decos);
            }
        }
    });
}

