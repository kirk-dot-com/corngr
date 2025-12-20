import * as Y from 'yjs';
import { Observable } from 'lib0/observable';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';

/**
 * TauriSyncProvider
 * 
 * A custom Yjs provider that uses Tauri's event system to synchronize
 * document updates and awareness state across multiple clients.
 * 
 * This bridges Yjs to the Rust backend, which acts as the authoritative
 * signaling and persistence layer.
 */
export class TauriSyncProvider extends Observable<any> {
    public doc: Y.Doc;
    public awareness: Awareness;
    private unlistenSync: UnlistenFn | null = null;
    private unlistenAwareness: UnlistenFn | null = null;

    constructor(doc: Y.Doc, awareness: Awareness = new Awareness(doc)) {
        super();
        this.doc = doc;
        this.awareness = awareness;

        // 1. Listen for local Yjs updates and send to Tauri
        this.doc.on('update', (update: Uint8Array, origin: any) => {
            if (origin !== this) {
                // Send update to Rust backend
                emit('yjs-update', Array.from(update)).catch(err => {
                    console.error('Failed to emit yjs-update:', err);
                });
            }
        });

        // 2. Listen for local awareness changes and send to Tauri
        this.awareness.on('update', ({ added, updated, removed }: any) => {
            const changedClients = added.concat(updated).concat(removed);
            const awarenessUpdate = encodeAwarenessUpdate(this.awareness, changedClients);

            emit('awareness-update', Array.from(awarenessUpdate)).catch(err => {
                console.error('Failed to emit awareness-update:', err);
            });
        });

        this.init();
    }

    private async init() {
        // 3. Listen for incoming updates from Rust
        this.unlistenSync = await listen<number[]>('yjs-update-remote', (event) => {
            const update = new Uint8Array(event.payload);
            Y.applyUpdate(this.doc, update, this);
        });

        // 4. Listen for incoming awareness from Rust
        this.unlistenAwareness = await listen<number[]>('awareness-update-remote', (event) => {
            const update = new Uint8Array(event.payload);
            applyAwarenessUpdate(this.awareness, update, this);
        });

        // 5. Request initial sync from backend
        emit('sync-request', {}).catch(err => {
            console.error('Failed to emit sync-request:', err);
        });

        console.log('TauriSyncProvider initialized');
    }

    public destroy() {
        if (this.unlistenSync) this.unlistenSync();
        if (this.unlistenAwareness) this.unlistenAwareness();
        super.destroy();
    }
}
