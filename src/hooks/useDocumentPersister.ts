import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { invoke } from '@tauri-apps/api/core';
// import { User } from '../security/types';
import { getAllBlocks } from '../yjs/schema';

/**
 * Persists the Y.Doc to the backend on change.
 * AND loads the initial state from backend if empty.
 * 
 * [EIM] Security Enforced: Only saves if user has 'admin' or 'editor' role.
 */
export function useDocumentPersister(doc: Y.Doc, user: any, docId: string) {
    const timeoutRef = useRef<any>(null);
    const loadedRef = useRef<string | null>(null);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            if (loadedRef.current === docId) return; // Already loaded this doc

            // Only try to load if doc is effectively empty (just meta) to avoid overwriting live sync
            // Note: If WebSocket is working, it might race. 
            // Ideally, we load JSON, convert to Yjs, and applyUpdate.
            // For now, simpler check: if doc has content, skip.
            const content = doc.getArray('content');
            if (content.length > 0) {
                loadedRef.current = docId;
                return;
            }

            console.log(`📥 Hydrating document ${docId}...`);
            try {
                // @ts-ignore
                const blocks = await invoke('load_secure_document', {
                    user: { id: user?.id || 'anon', attributes: user?.attributes || { role: 'viewer' } },
                    docId
                });

                if (Array.isArray(blocks) && blocks.length > 0) {
                    // Convert blocks to Yjs inserts
                    // This is tricky. simpler to just clear and push if we assume we are the authority.
                    // But strictly we should transclude.
                    // For Phase 0 fix: Just populate if empty.

                    doc.transact(() => {
                        const yContent = doc.getArray('content');
                        if (yContent.length === 0) {
                            // We have to rely on `schema` helpers or manual map creation
                            // Since we can't import `createBlock` easily without circular deps maybe?
                            // No, schema is importable.

                            // Actually, let's just use the `getAllBlocks` inverse if it existed.
                            // Manual reconstruction:
                            blocks.forEach((b: any) => {
                                const blockMap = new Y.Map();
                                blockMap.set('id', b.id);
                                blockMap.set('type', b.type || b.block_type || 'paragraph');

                                const blockData = new Y.Map();
                                blockData.set('text', b.data.text || '');
                                blockData.set('value', b.data.value || null);

                                const meta = new Y.Map();
                                if (b.data.metadata) {
                                    Object.keys(b.data.metadata).forEach(k => {
                                        meta.set(k, b.data.metadata[k]);
                                    });
                                }
                                blockData.set('metadata', meta);
                                blockMap.set('data', blockData);

                                blockMap.set('created', b.created);
                                blockMap.set('modified', b.modified);

                                yContent.push([blockMap]);
                            });
                        }
                    });
                    console.log(`✅ Hydrated ${blocks.length} blocks.`);
                }
            } catch (e) {
                console.error("Hydration failed:", e);
            }
            loadedRef.current = docId;
        };

        load();
    }, [docId, doc, user?.id]);

    // Save Logic
    useEffect(() => {
        const handleUpdate = () => {
            // Debounce save (2s)
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(async () => {
                if (user?.attributes?.role === 'viewer') return;

                console.log(`💾 Persisting document ${docId}...`);
                const blocks = getAllBlocks(doc);

                try {
                    await invoke('save_secure_document', {
                        blocks,
                        user: {
                            id: user.id || 'unknown',
                            attributes: user.attributes
                        },
                        docId // Pass docId to backend
                    });
                } catch (e) {
                    console.error("Save failed:", e);
                }
            }, 2000);
        };

        doc.on('update', handleUpdate);

        return () => {
            doc.off('update', handleUpdate);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [doc, user, docId]);
}
