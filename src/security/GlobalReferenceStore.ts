import { Observable } from 'lib0/observable';

/**
 * GlobalReferenceStore [SPRINT 3]
 * 
 * Manages cross-document references (transclusions).
 * Acts as a registry of external blocks that the current document 
 * depends on or provides to others.
 * 
 * DESIGN PRINCIPLE: "No Caching of Content".
 * This store only tracks pointers (doc_id, block_id, origin_url).
 * The actual resolution must go through the TauriSecureNetwork to force
 * an ABAC check against the source document's auth engine.
 */
export interface ExternalReference {
    id: string; // Internal pointer ID
    targetDocId: string;
    targetBlockId: string;
    originUrl: string;
    lastVerified: string;
    status: 'active' | 'broken' | 'denied';
}

export class GlobalReferenceStore extends Observable<any> {
    private references: Map<string, ExternalReference> = new Map();

    constructor() {
        super();
        console.log('📡 GlobalReferenceStore initialized');
    }

    /**
     * Register a new transclusion dependency
     */
    public addReference(ref: ExternalReference) {
        this.references.set(ref.id, ref);
        this.emit('update', [this.references]);
    }

    /**
     * Get all references for documented prefetching [Sprint 4]
     */
    public listAll(): ExternalReference[] {
        return Array.from(this.references.values());
    }

    /**
     * Get all references for a specific block
     */
    public getReferences(): ExternalReference[] {
        return Array.from(this.references.values());
    }

    /**
     * Find a specific reference
     */
    public getReference(id: string): ExternalReference | undefined {
        return this.references.get(id);
    }

    /**
     * Update reference status (e.g., after a failed ABAC check)
     */
    public updateStatus(id: string, status: ExternalReference['status']) {
        const ref = this.references.get(id);
        if (ref) {
            ref.status = status;
            ref.lastVerified = new Date().toISOString();
            this.emit('update', [this.references]);
        }
    }
}
