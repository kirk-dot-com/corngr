import { invoke } from '@tauri-apps/api/core';
import { UserContext } from '../security/UserContext';

export interface DocumentInfo {
    id: string;
    filename: string;
    modified: string;
    title?: string;
}

class DocumentStore {
    private documents: DocumentInfo[] = [];
    private listeners: Set<() => void> = new Set();
    public isLoading = false;

    async fetchDocuments() {
        this.isLoading = true;
        this.notify();
        try {
            // @ts-ignore
            const tauriInvoke = window.__TAURI__?.core?.invoke || invoke;
            const docs = await tauriInvoke('list_documents') as DocumentInfo[];

            // Map known titles (simulated metadata for now, or assume filename is title)
            this.documents = docs.map(d => ({
                ...d,
                title: this.prettifyTitle(d.id)
            }));

        } catch (e) {
            console.error("Failed to list documents:", e);
        } finally {
            this.isLoading = false;
            this.notify();
        }
    }

    getDocuments() {
        return this.documents;
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    private prettifyTitle(id: string) {
        if (id === 'doc_default' || id === 'demo') return 'Project Alpha';
        if (id.startsWith('doc_')) return 'Untitled Document ' + id.substring(4, 8);
        return id;
    }
}

export const documentStore = new DocumentStore();
