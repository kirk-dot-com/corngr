
import * as Y from 'yjs';
import { User } from './types';
import { getAllBlocks } from '../yjs/schema';

// In a real app, this would be imported from @tauri-apps/api
// import { invoke } from '@tauri-apps/api/core';

// Mock invoke for environments without Tauri
const invoke = async <T>(cmd: string, args: any): Promise<T> => {
    console.log(`🦀 Tauri Invoke: ${cmd}`, args);
    if (cmd === 'check_block_permission') return true as unknown as T;
    if (cmd === 'save_secure_document') return true as unknown as T;
    if (cmd === 'reset_secure_document') return true as unknown as T;
    // Default for load_secure_document
    return [] as unknown as T;
};

/**
 * Connects the Frontend (Yjs) to the Local-First Backend (Tauri/Rust)
 * Replaces the 'MockSecureNetwork' from Phase 0.
 */
export class TauriSecureNetwork {
    private clientDoc: Y.Doc;
    private user: User;

    constructor(clientDoc: Y.Doc, user: User) {
        this.clientDoc = clientDoc;
        this.user = user;
        this.sync();
    }

    public async sync() {
        console.log('🔄 Requesting Secure Doc from Rust...');

        try {
            // 1. Request Filtered Data from Rust (The "Server")
            // Rust performs the ABAC check and returns only blocks this user can see.
            const blocks = await invoke('load_secure_document', { user: this.user });

            // 2. Update Client View (Prosemirror Fragment)
            // Phase 1 Fix: Populate the Prosemirror XML Fragment so the Editor sees the data
            this.clientDoc.transact(() => {
                const fragment = this.clientDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
                fragment.delete(0, fragment.length);

                const nodes = (blocks as any[]).map(block => {
                    // Map Block -> PM Node
                    let nodeName = 'paragraph';
                    let attrs: any = {};

                    if (block.type === 'heading1') {
                        nodeName = 'heading';
                        attrs = { level: 1 };
                    } else if (block.type === 'heading2') {
                        nodeName = 'heading';
                        attrs = { level: 2 };
                    } else if (block.type === 'variable') {
                        nodeName = 'variable';
                        // Map variable data if present
                    }

                    const node = new Y.XmlElement(nodeName);
                    for (const [k, v] of Object.entries(attrs)) {
                        node.setAttribute(k, v);
                    }

                    if (block.data.text) {
                        const text = new Y.XmlText(block.data.text);
                        node.insert(0, [text]);
                    }
                    return node;
                });

                if (nodes.length > 0) {
                    fragment.insert(0, nodes);
                }
            });

            console.log('✅ Client View updated via Secure Bridge');
        } catch (e) {
            console.error('❌ Failed to sync with Tauri backend', e);
        }
    }

    public async save() {
        console.log('💾 Saving to File System (Rust)...');

        // Phase 1 Fix: Get blocks from the Prosemirror Fragment (Source of Truth)
        const blocks = getAllBlocks(this.clientDoc);

        const success = await invoke('save_secure_document', { blocks, user: this.user });

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
