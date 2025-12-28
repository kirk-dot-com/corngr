
import * as Y from 'yjs';
import { User } from './types';
import { getAllBlocks } from '../yjs/schema';
import { MetadataStore } from '../metadata/MetadataStore';
import { TauriSyncProvider } from './TauriSyncProvider';
import { GlobalReferenceStore } from './GlobalReferenceStore';

// Import the REAL Tauri invoke function to connect to Rust backend
import { invoke } from '@tauri-apps/api/tauri';

// [Phase 4] Supabase Client
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ENABLE_CLOUD_SYNC } from '../config/SupabaseConfig';

/**
 * Connects the Frontend (Yjs) to the Local-First Backend (Tauri/Rust)
 * Replaces the 'MockSecureNetwork' from Phase 0.
 * 
 * Phase 2: Dual-Layer Architecture
 * - ProseMirror handles content
 * - MetadataStore handles security metadata (classification, ACL, provenance)
 * 
 * [Phase 4] Integrated Cloud Persistence (Supabase)
 */
export class TauriSecureNetwork {
    private clientDoc: Y.Doc;
    private user: User;
    private metadataStore: MetadataStore;
    private syncProvider: TauriSyncProvider;
    private referenceStore: GlobalReferenceStore;

    // [Phase 4] Cloud Client
    private supabase: SupabaseClient | null = null;

    constructor(clientDoc: Y.Doc, user: User) {
        this.clientDoc = clientDoc;
        this.user = user;
        this.metadataStore = new MetadataStore();
        this.referenceStore = new GlobalReferenceStore();

        // Phase 3: Collaborative Sync Provider
        this.syncProvider = new TauriSyncProvider(this.clientDoc);

        // [Phase 4] Initialize Cloud Persistence
        if (ENABLE_CLOUD_SYNC) {
            console.log('☁️ Initializing Supabase Cloud Sync...');
            this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }

        this.initMetadataSync();
        this.sync();
    }

    // ... existing initMetadataSync ...

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

            // [Phase 4] Cloud Backup
            if (this.supabase && ENABLE_CLOUD_SYNC) {
                this.saveToCloud(enrichedBlocks);
            }

        } else {
            console.error('❌ Save rejected by backend (Permission denied).');
        }
    }

    /**
     * [Phase 4] Persist state to Supabase
     */
    private async saveToCloud(blocks: any[]) {
        if (!this.supabase) return;

        console.log('☁️ Syncing to Supabase...');
        const update = Y.encodeStateAsUpdate(this.clientDoc);

        // Convert Uint8Array to Base64 for storage
        // In a real app we'd use a binary column, but strings are easier for prototypes
        const contentBase64 = this.toBase64(update);

        const { error } = await this.supabase
            .from('documents')
            .upsert({
                id: 'doc_default', // Single doc for now
                content: contentBase64,
                owner_id: this.user.id,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('☁️❌ Cloud Sync Failed:', error.message);
        } else {
            console.log('☁️✅ Cloud Sync Successful');
        }
    }

    private toBase64(bytes: Uint8Array): string {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    /**
     * Phase 3: Real-time Metadata Sync via Yjs Awareness
     */
    private initMetadataSync() {
        const awareness = this.syncProvider.awareness;

        // 1. Listen for LOCAL metadata changes and broadcast via Awareness
        this.metadataStore.on('update', (updates: Array<{ blockId: string, metadata: any }>) => {
            const currentMetadata = awareness.getLocalState()?.metadata || {};

            updates.forEach(({ blockId, metadata }) => {
                currentMetadata[blockId] = metadata;
            });

            awareness.setLocalStateField('metadata', currentMetadata);
            console.log(`📡 [Phase 3] Broadcasted metadata update for ${updates.length} blocks via Awareness`);
        });

        // 2. Listen for REMOTE metadata changes and apply to local Store
        awareness.on('change', () => {
            const states = awareness.getStates();
            states.forEach((state, _clientId) => {
                if (state.metadata) {
                    Object.entries(state.metadata).forEach(([blockId, metadata]) => {
                        const existing = this.metadataStore.get(blockId);
                        if (JSON.stringify(existing) !== JSON.stringify(metadata)) {
                            // Directly update internal map to avoid loops
                            (this.metadataStore as any).metadata.set(blockId, metadata);
                        }
                    });
                }
            });
        });
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



    /**
     * Phase 4: Request Capability Token [SPRINT 4]
     * Pre-flight handshake to optimize transclusion resolution.
     */
    public async requestCapabilityToken(refId: string): Promise<any> {
        const ref = this.referenceStore.getReference(refId);
        if (!ref) return null;

        console.log(`🔑 [Sprint 4] Initiating Handshake: ${refId}`);
        try {
            const token = await invoke('request_capability_token', {
                req: {
                    origin_url: ref.originUrl,
                    doc_id: ref.targetDocId,
                    block_id: ref.targetBlockId,
                    user: this.user
                }
            });

            this.metadataStore.setToken(refId, token);
            console.log(`✅ [Sprint 4] Capability Token acquired for ${refId}`);
            return token;
        } catch (e) {
            console.warn(`🔒 [Sprint 4] Handshake failed for ${refId}:`, e);
            return null;
        }
    }

    /**
     * Proactively prefetch capability tokens for all references
     */
    public async initCapabilityPrefetch() {
        const refs = this.referenceStore.listAll();
        console.log(`⚡ [Sprint 4] Proactively prefetching ${refs.length} capability tokens...`);
        for (const ref of refs) {
            this.requestCapabilityToken(ref.id);
        }
    }

    /**
     * Phase 3: Global Transclusion resolution [SPRINT 3]
     * Resolves an external block by its pointer, forcing a fresh ABAC check.
     * UPDATED Phase 4: Uses pre-fetched capability tokens if available.
     */
    public async resolveExternalReference(refId: string): Promise<any> {
        const ref = this.referenceStore.getReference(refId);
        if (!ref) return null;

        const token = this.metadataStore.getToken(refId);
        console.log(`📡 [Sprint 4] Resolving Reference: ${refId} (Token: ${token ? 'AVAILABLE' : 'MISSING'})`);

        try {
            const block = await invoke('fetch_external_block', {
                user: this.user,
                origin_url: ref.originUrl,
                doc_id: ref.targetDocId,
                block_id: ref.targetBlockId,
                token: token ? `${token.token_id}:${token.signature}` : undefined
            });

            this.referenceStore.updateStatus(refId, 'active');
            return block;
        } catch (e) {
            console.error(`❌ Global Reference Resolution Failed: ${refId}`, e);
            this.referenceStore.updateStatus(refId, 'denied');
            return null;
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

    public getReferenceStore(): GlobalReferenceStore {
        return this.referenceStore;
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
