
import * as Y from 'yjs';
import { User } from './types';
// In a real app, this would be imported from @tauri-apps/api
// import { invoke } from '@tauri-apps/api/core';

// Mock invoke for environments without Tauri
const invoke = async (cmd: string, args: any) => {
    console.log(`🦀 Tauri Invoke: ${cmd}`, args);
    // In a real scenario, this returns data from Rust
    return [];
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

            // 2. Update Client View
            // We trust the backend. We blindly replace the client view with the backend response.
            this.clientDoc.transact(() => {
                const content = this.clientDoc.getArray('content');
                content.delete(0, content.length);
                content.insert(0, blocks as any);
            });

            console.log('✅ Client View updated via Secure Bridge');
        } catch (e) {
            console.error('❌ Failed to sync with Tauri backend', e);
        }
    }

    public async save() {
        console.log('💾 Saving to File System (Rust)...');
        const blocks = this.clientDoc.getArray('content').toJSON();

        // Note: In real app, we would send the DIFF, not the whole doc.
        // For Phase 1 prototype, we push the whole JSON.
        const success = await invoke('save_secure_document', { blocks, user: this.user });

        if (success) {
            console.log('✅ Save confirmed by backend.');
        } else {
            console.error('❌ Save rejected by backend (Permission denied).');
        }
    }

    public updateUser(newUser: User) {
        this.user = newUser;
        this.sync();
    }
}
