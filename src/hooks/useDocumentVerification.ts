import { useState, useEffect } from 'react';
import { EditorView } from 'prosemirror-view';
import { MetadataStore } from '../metadata/MetadataStore';
import { invoke } from '@tauri-apps/api/core';
import { sha256 } from '../utils/crypto';

export type VerificationStatus = 'verified' | 'tampered' | 'unsigned' | 'unknown' | 'verifying';

export function useDocumentVerification(editorView: EditorView | null, metadataStore: MetadataStore | null) {
    const [verificationResults, setVerificationResults] = useState<Record<string, VerificationStatus>>({});
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (!editorView || !metadataStore) return;

        const verifyDoc = async () => {
            setIsVerifying(true);
            const results: Record<string, VerificationStatus> = {};
            const promises: Promise<void>[] = [];

            editorView.state.doc.descendants((node) => {
                // Only verify blocks with IDs (paragraphs, headings)
                if (!node.isBlock || !node.attrs.blockId) return false;

                const blockId = node.attrs.blockId;
                const metadata = metadataStore.get(blockId);
                const signature = metadata?.provenance?.signature;

                if (signature) {
                    results[blockId] = 'verifying';

                    const p = async () => {
                        try {
                            const contentHash = await sha256(node.textContent);
                            const isValid = await invoke<boolean>('verify_block_signature', {
                                blockId,
                                contentHash,
                                signatureHex: signature
                            });
                            results[blockId] = isValid ? 'verified' : 'tampered';

                            if (!isValid) {
                                console.warn(`🚨 Block ${blockId} verification FAILED`);
                                // TODO: Send audit log command to backend
                            }
                        } catch (e) {
                            console.error(`Verification error for ${blockId}:`, e);
                            results[blockId] = 'unknown';
                        }
                    };
                    promises.push(p());
                } else {
                    results[blockId] = 'unsigned';
                }

                // Do not descend into children of blocks (text nodes don't have blockIds)
                return false;
            });

            if (promises.length > 0) {
                await Promise.all(promises);
            }

            // Only update state if results actually exist
            if (Object.keys(results).length > 0) {
                setVerificationResults(results);
            }
            setIsVerifying(false); // Done
        };

        // Run verification
        verifyDoc();

    }, [editorView, metadataStore]);
    // Dependency note: If doc changes, this doesn't strictly re-run unless editorView object changes.
    // Ideally we want to run on Load. `editorView` is stable ref usually.
    // If we want to re-run on demand, we can expose a `refetch` function.

    return { verificationResults, isVerifying };
}
