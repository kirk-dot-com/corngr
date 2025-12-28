import * as Y from 'yjs';
import { User } from './types';
import { canViewBlock } from './permissions';
import { Block } from '../yjs/schema';

/**
 * Simulates a server-side process that syncs data from a "Server Doc" (Full Truth)
 * to a "Client Doc" (Filtered View) based on the user's permissions.
 * 
 * In a real architecture, this would happen in a Supabase Edge Function or 
 * custom WebSocket server using y-sync-protocol interceptors.
 */
export class MockSecureNetwork {
    private serverDoc: Y.Doc;
    private clientDoc: Y.Doc;
    private user: User;
    private isSyncing = false;

    constructor(serverDoc: Y.Doc, clientDoc: Y.Doc, user: User) {
        this.serverDoc = serverDoc;
        this.clientDoc = clientDoc;
        this.user = user;

        // Initial Sync
        this.syncServerToClient();

        // Listen for Server changes -> Push to Client (Filtered)
        serverDoc.on('update', (_update: Uint8Array) => {
            // In a real app we'd decode the update, filter it, and re-encode.
            // For this sim, we just trigger a full re-scan sync because decoding generic Yjs updates 
            // to filter specific array items is complex. 
            // We will re-run the "Smart Copy" logic.
            this.syncServerToClient();
        });
    }

    /**
     * "Smart Copy" from Server Array to Client Array
     * filtering out items the user cannot see.
     */
    public syncServerToClient() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const serverContent = this.serverDoc.getArray('content');
            const clientContent = this.clientDoc.getArray('content');

            // We use a transaction to make it atomic
            this.clientDoc.transact(() => {
                // FIX: Use toJSON() to get plain JS objects. 
                // Using toArray() returns Y.Map instances bound to serverDoc, which causes 
                // 1. Types errors (no .data property on Y.Map)
                // 2. Yjs errors (cannot insert Y.Map from one doc to another)
                const serverBlocks = serverContent.toJSON() as Block[];

                // 1. Filter blocks based on permissions
                // Now serverBlocks are plain JSON, so block.data.metadata works!
                const allowedBlocks = serverBlocks.filter(block =>
                    canViewBlock(this.user, block.data.metadata)
                );

                // 2. Diff and Update Client Doc
                const clientBlocks = clientContent.toJSON() as Block[];
                const serverIds = allowedBlocks.map(b => b.id).join(',');
                const clientIds = clientBlocks.map(b => b.id).join(',');

                if (serverIds !== clientIds) {
                    // Full replace for prototype simplicity
                    clientContent.delete(0, clientContent.length);

                    // Insert plain objects. 
                    // Note: Yjs will store these as JSON primitives/maps. 
                    // This works fine for SlideRenderer (which calls toJSON).
                    // It might break ProseMirror binding if it strictly expects Y.Map instances, 
                    // but for Phase 0 "Dual Rendering" validation, ensuring Slide View security is priority.
                    clientContent.insert(0, allowedBlocks);

                    console.log(`🔒 SecureSync: Synced ${allowedBlocks.length} blocks to ${this.user.attributes.role} (Filtered from ${serverBlocks.length})`);
                }
            });
        } finally {
            this.isSyncing = false;
        }
    }

    public updateUser(newUser: User) {
        this.user = newUser;
        this.syncServerToClient();
    }
}
