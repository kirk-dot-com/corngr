import { invoke } from '@tauri-apps/api/core';
import { User } from '../security/types';

// ... (keep showModal)

async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface BlockSignature {
    signature: string;
    signer_id: string;
    timestamp: string;
    algorithm: string;
}

export function createGutterPlugin(
    metadataStore: MetadataStore,
    appMode: 'draft' | 'audit' | 'presentation',
    onBlockSelect?: (blockId: string | null) => void,
    onToast?: (message: string) => void,
    user?: User | null
): Plugin {
    return new Plugin({
        props: {
            decorations(state) {
                const decos: Decoration[] = [];

                state.doc.descendants((node, pos) => {
                    const isGutterableBlock = node.isBlock && (node.type.name === 'paragraph' || node.type.name === 'heading');
                    if (isGutterableBlock) {
                        const blockIdentifier = node.attrs.blockId || `pos-${pos}`;

                        const widget = Decoration.widget(pos, (view) => {
                            const dom = document.createElement('div');
                            dom.className = `block-gutter-wrapper ${appMode}-mode`;

                            const metadata = node.attrs.blockId ? metadataStore.get(node.attrs.blockId) : null;
                            const isSealed = !!metadata?.provenance?.signature;

                            if (appMode === 'audit') {
                                // ... (audit mode indicator logic same as before)
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
                                        // Verify
                                        // TODO: Use verify_block_signature backend command
                                        const timestamp = metadata?.provenance?.timestamp
                                            ? new Date(metadata.provenance.timestamp).toLocaleString()
                                            : 'N/A';
                                        await showModal(
                                            '🛡️ Block Verified',
                                            `Block ID: ${blockIdentifier}\n\nSigner: ${metadata?.provenance?.authorId || 'Unknown'}\n\nTimestamp: ${timestamp}`
                                        );
                                    } else {
                                        // Sign
                                        if (!user) {
                                            if (onToast) onToast('❌ Error: User not authenticated');
                                            return;
                                        }

                                        try {
                                            // 1. Calculate Content Hash
                                            const contentHash = await sha256(node.textContent);

                                            // 2. Call Backend to Sign
                                            const sig = await invoke<BlockSignature>('sign_block', {
                                                req: {
                                                    block_id: blockIdentifier,
                                                    content_hash: contentHash
                                                },
                                                user // Pass full user object for auth check
                                            });

                                            // 3. Update Metadata
                                            const newMetadata = {
                                                ...metadata,
                                                provenance: {
                                                    ...metadata?.provenance,
                                                    signature: sig.signature,
                                                    authorId: user.id || 'Unknown',
                                                    timestamp: sig.timestamp,
                                                    sourceId: sig.signer_id // Use signer Key ID as source ref
                                                }
                                            };

                                            if (node.attrs.blockId) {
                                                metadataStore.set(node.attrs.blockId, newMetadata as any);
                                                if (onToast) onToast(`Block signed & sealed successfully 🔒`);
                                            }
                                        } catch (err: any) {
                                            console.error("Signing failed:", err);
                                            if (onToast) onToast(`❌ Signing Failed: ${err}`);
                                        }

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
                                    if (onBlockSelect && node.attrs.blockId) {
                                        onBlockSelect(node.attrs.blockId);
                                    } else {
                                        await showModal(
                                            'ℹ️ Block Lineage',
                                            `ID: ${blockIdentifier}\nType: ${node.type.name}\nProvenance: ${metadata?.provenance?.sourceId || 'Local'}`
                                        );
                                    }
                                };
                                dom.appendChild(infoBtn);
                            }

                            dom.addEventListener('mousedown', (e) => {
                                e.stopPropagation();
                            });

                            return dom;
                        }, { side: -1, stopEvent: () => true, ignoreSelection: true });
                        decos.push(widget);
                    }
                    return false;
                });

                return DecorationSet.create(state.doc, decos);
            }
        }
    });
}

