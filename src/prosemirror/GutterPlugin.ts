import { invoke } from '@tauri-apps/api/core';
import { User } from '../security/types';
import { sha256 } from '../utils/crypto';

import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { MetadataStore, VerificationStatus } from '../metadata/MetadataStore';
async function showModal(title: string, body: string) {
    // Fallback for browser (plugin-dialog not installed)
    alert(`${title}\n\n${body}`);
}

// Helper function to calculate SHA-256 hash
// (Moved to shared util, import above)

interface BlockSignature {
    signature: string;
    signer_id: string;
    timestamp: string;
    algorithm: string;
}

// export type VerificationStatus = ... (Removed, using Store type)

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
                                // Check verification status from store
                                const status = metadataStore.getVerificationStatus(blockIdentifier);

                                // Sign Button
                                const signBtn = document.createElement('button');
                                signBtn.className = `gutter-btn ${isSealed ? 'active' : ''}`;

                                if (status === 'tampered') {
                                    signBtn.innerHTML = '⚠️';
                                    signBtn.className += ' status-tampered';
                                    signBtn.title = 'SECURITY WARNING: Block content has been modified since signing!';
                                } else if (status === 'verifying') {
                                    signBtn.innerHTML = '⌛';
                                    signBtn.className += ' status-verifying';
                                    signBtn.title = 'Verifying signature...';
                                } else if (status === 'verified') {
                                    signBtn.innerHTML = '🔒'; // Or ✅
                                    signBtn.className += ' status-verified';
                                    signBtn.title = 'Verified: Signature matches content';
                                } else {
                                    signBtn.innerHTML = isSealed ? '🔒' : '🔏';
                                    signBtn.title = isSealed ? 'Sealed Block (Click to verify)' : 'Sign & Seal Block';
                                }

                                signBtn.onclick = async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    if (isSealed) {
                                        // Verify
                                        let message = 'Verifying signature...';
                                        let title = '🛡️ Block Verification';

                                        try {
                                            const contentHash = await sha256(node.textContent);
                                            const isValid = await invoke<boolean>('verify_block_signature', {
                                                blockId: blockIdentifier,
                                                contentHash,
                                                signatureHex: metadata?.provenance?.signature
                                            });

                                            const timestamp = metadata?.provenance?.timestamp
                                                ? new Date(metadata.provenance.timestamp).toLocaleString()
                                                : 'N/A';

                                            if (isValid) {
                                                title = '✅ Signature Valid';
                                                message = `Block ID: ${blockIdentifier}\n\nSigner: ${metadata?.provenance?.authorId || 'Unknown'}\nKey ID: ${metadata?.provenance?.sourceId || 'Unknown'}\nTimestamp: ${timestamp}\n\nThis block has NOT been modified since signing.`;
                                            } else {
                                                title = '⚠️ INVALID SIGNATURE';
                                                message = `Block ID: ${blockIdentifier}\n\nINTEGRITY CHECK FAILED!\n\nThe content of this block has been modified after it was signed.\n\nExpected Hash: (Hidden)\nActual Hash: ${contentHash.substring(0, 8)}...`;
                                            }
                                        } catch (e) {
                                            title = '❌ Verification Error';
                                            message = `Could not verify signature: ${e}`;
                                        }

                                        await showModal(title, message);
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

