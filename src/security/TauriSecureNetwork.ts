
import * as Y from 'yjs';
import { User } from './types';
import { getAllBlocks } from '../yjs/schema';
import { MetadataStore } from '../metadata/MetadataStore';
import { TauriSyncProvider } from './TauriSyncProvider';

// Import the REAL Tauri invoke function to connect to Rust backend
import { invoke } from '@tauri-apps/api/core';


/**
 * Connects the Frontend (Yjs) to the Local-First Backend (Tauri/Rust)
 * Replaces the 'MockSecureNetwork' from Phase 0.
 * 
 * Phase 2: Dual-Layer Architecture
 * - ProseMirror handles content
 * - MetadataStore handles security metadata (classification, ACL, provenance)
 */
export class TauriSecureNetwork {
    private user: User;
    private metadataStore: MetadataStore;
    private syncProvider: TauriSyncProvider;

    constructor(clientDoc: Y.Doc, user: User) {
        this.clientDoc = clientDoc;
        this.user = user;
        this.metadataStore = new MetadataStore();

        // Phase 3: Collaborative Sync Provider
        this.syncProvider = new TauriSyncProvider(this.clientDoc);

        this.sync();
    }

    public async sync() {
        console.log('═══════════════════════════════════════════');
        console.log('🔄 SYNC: Requesting blocks from Rust backend');
        console.log('   User:', this.user.id, '|', this.user.attributes.role, '| Clearance:', this.user.attributes.clearanceLevel);

        try {
            // 1. Request Filtered Data from Rust (The "Server")
            const blocks = await invoke('load_secure_document', { user: this.user });

            console.log('📦 RUST RETURNED:', (blocks as any[]).length, 'blocks');
            console.log('   Block details:');
            (blocks as any[]).forEach((b: any, i: number) => {
                const classification = b.data?.metadata?.classification || 'none';
                const acl = b.data?.metadata?.acl || [];
                console.log(`   ${i + 1}. [${b.type}] "${b.data?.text?.substring(0, 30) || 'variable'}" | Class: ${classification} | ACL: ${JSON.stringify(acl)}`);
            });

            // 2. Phase 2: Split content and metadata (Dual-Layer Architecture)
            console.log('🔐 [Phase 2] Extracting metadata to shadow store...');
            this.metadataStore.loadFromBackend(blocks as any[]);

            // 3. Update Client View (ProseMirror Fragment) - Content Only
            this.clientDoc.transact(() => {
                const fragment = this.clientDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
                fragment.delete(0, fragment.length);

                const nodes = (blocks as any[]).map(block => {
                    let nodeName = 'paragraph';
                    let attrs: any = {};

                    // Phase 2: Preserve stable block ID
                    attrs.blockId = block.id;

                    if (block.type === 'heading1') {
                        nodeName = 'heading';
                        attrs.level = 1;
                    } else if (block.type === 'heading2') {
                        nodeName = 'heading';
                        attrs.level = 2;
                    } else if (block.type === 'variable') {
                        nodeName = 'variable';
                        if (block.data?.value) {
                            attrs.name = block.data.value.name;
                            attrs.value = block.data.value.value;
                            attrs.format = block.data.value.format || 'text';
                        }
                    }

                    const node = new Y.XmlElement(nodeName);
                    for (const [k, v] of Object.entries(attrs)) {
                        node.setAttribute(k, String(v));
                    }

                    if (block.data?.text) {
                        const text = new Y.XmlText(block.data.text);
                        node.insert(0, [text]);
                    }
                    return node;
                });

                if (nodes.length > 0) {
                    fragment.insert(0, nodes);
                }
            });

            console.log('✅ SYNC COMPLETE: Loaded', (blocks as any[]).length, 'filtered blocks into editor');
            console.log(`🔐 MetadataStore now contains ${this.metadataStore.size()} entries`);
            console.log('═══════════════════════════════════════════\n');
        } catch (e) {
            console.error('❌ Failed to sync with Tauri backend', e);
        }
    }

    public async save() {
        console.log('💾 Saving to File System (Rust)...');

        // Phase 1 Fix: Get blocks from the Prosemirror Fragment (Source of Truth)
        const blocks = getAllBlocks(this.clientDoc);

        // Phase 2: Enrich blocks with metadata from shadow store
        const enrichedBlocks = blocks.map(b => ({
            ...b,
            data: {
                ...b.data,
                // Merge metadata from shadow store (or keep existing if not in store)
                metadata: this.metadataStore.get(b.id) || b.data.metadata
            }
        }));

        console.log(`🔐 [Phase 2] Enriched ${enrichedBlocks.length} blocks with metadata from shadow store`);

        const success = await invoke('save_secure_document', { blocks: enrichedBlocks, user: this.user });

        if (success) {
            console.log('✅ Save confirmed by backend.');
        } else {
            console.error('❌ Save rejected by backend (Permission denied).');
        }
    }

    /**
     * Checks permission for a specific block/action against the Rust ABAC engine.
     */
    public async checkPermission(blockId: string, action: string): Promise<boolean> {
        return await invoke('check_block_permission', {
            user: this.user,
            block_id: blockId,
            action
        });
    }

    public updateUser(newUser: User) {
        this.user = newUser;
        this.sync();
    }

    /**
     * Phase 2: Public access to MetadataStore for UI components
     * (BlockRenderer, MetadataPanel, FilterPlugin)
     */
    public getMetadataStore(): MetadataStore {
        return this.metadataStore;
    }

    public getSyncProvider(): TauriSyncProvider {
        return this.syncProvider;
    }

    public async reset() {
        console.log('🗑️ Resetting Secure Document to Default...', { user: this.user });
        const success = await invoke('reset_secure_document', { user: this.user });
        console.log('🗑️ Reset result:', success);
        if (success) {
            console.log('✅ Reset confirmed by backend. Reloading mock data...');
            await this.sync(); // Reload mock data
            alert('✅ Data reset to Mock Security Test Data');
        } else {
            console.error('❌ Reset failed - you may not have admin permissions');
            alert('❌ Reset failed - Admin role required');
        }
    }
}
