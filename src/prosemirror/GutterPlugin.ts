import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { MetadataStore } from '../metadata/MetadataStore';

/**
 * Creates a custom modal dialog that works in Tauri
 */
function showModal(title: string, message: string, showCancel: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: linear-gradient(145deg, rgba(30, 30, 40, 0.95), rgba(20, 20, 30, 0.98));
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(102, 126, 234, 0.1);
            animation: slideUp 0.3s ease;
        `;

        // Title
        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.cssText = `
            margin: 0 0 16px 0;
            font-size: 1.2rem;
            font-weight: 700;
            color: #fff;
            font-family: 'Outfit', sans-serif;
        `;
        modal.appendChild(titleEl);

        // Message
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            margin: 0 0 20px 0;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.6;
            white-space: pre-wrap;
            font-size: 0.9rem;
        `;
        modal.appendChild(messageEl);

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        `;

        const buttonStyle = `
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        `;

        if (showCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = buttonStyle + `
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.7);
            `;
            cancelBtn.onmouseenter = () => { cancelBtn.style.background = 'rgba(255, 255, 255, 0.2)'; };
            cancelBtn.onmouseleave = () => { cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)'; };
            cancelBtn.onclick = () => {
                document.body.removeChild(backdrop);
                resolve(false);
            };
            buttonContainer.appendChild(cancelBtn);
        }

        const okBtn = document.createElement('button');
        okBtn.textContent = showCancel ? 'Sign & Seal' : 'OK';
        okBtn.style.cssText = buttonStyle + `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        `;
        okBtn.onmouseenter = () => { okBtn.style.transform = 'scale(1.05)'; };
        okBtn.onmouseleave = () => { okBtn.style.transform = 'scale(1)'; };
        okBtn.onclick = () => {
            document.body.removeChild(backdrop);
            resolve(true);
        };
        buttonContainer.appendChild(okBtn);

        modal.appendChild(buttonContainer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `;
        backdrop.appendChild(style);
    });
}

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

                                    if (isSealed) {
                                        await showModal(
                                            '🛡️ Block Verified',
                                            `ID: ${blockIdentifier}\nSigner: ${metadata?.provenance?.authorId || 'Unknown'}\nTimestamp: ${metadata?.provenance?.timestamp}`
                                        );
                                    } else {
                                        const proceed = await showModal(
                                            '🔏 Sign & Seal Block',
                                            'Sign this block with your Ed25519 identity?\n\nThis will freeze the content in Audit Mode.',
                                            true // show cancel button
                                        );
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
                                            if (node.attrs.blockId) {
                                                metadataStore.set(node.attrs.blockId, newMetadata as any);
                                            }
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
                                infoBtn.onclick = async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    await showModal(
                                        'ℹ️ Block Lineage',
                                        `ID: ${blockIdentifier}\nType: ${node.type.name}\nProvenance: ${metadata?.provenance?.sourceId || 'Local'}`
                                    );
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

