import { BlockMetadata } from '../yjs/schema';
import { Observable } from 'lib0/observable';
import * as Y from 'yjs';

export type VerificationStatus = 'verified' | 'tampered' | 'unsigned' | 'unknown' | 'verifying';

/**
 * Shadow Metadata Store for Phase 2
 * 
 * Maintains a 1:1 mapping between block IDs and their security metadata.
 */
export class MetadataStore extends Observable<any> {
    private metadata: Map<string, BlockMetadata>;
    private capabilityTokens: Map<string, any>; // [Sprint 4] Ephemeral Handshake Tokens
    private verificationStatus: Map<string, VerificationStatus>; // [Phase 2] Ephemeral Verification Status

    constructor() {
        super();
        this.metadata = new Map();
        this.capabilityTokens = new Map();
        this.verificationStatus = new Map();
    }

    setVerificationStatus(blockId: string, status: VerificationStatus): void {
        this.verificationStatus.set(blockId, status);
        // Emit specific event or general update?
        // GutterPlugin needs to re-render. 
        // We can emit 'verification' event.
        this.emit('verification', [{ blockId, status }]);
    }

    getVerificationStatus(blockId: string): VerificationStatus | null {
        return this.verificationStatus.get(blockId) || null;
    }

    getVerificationStats(): Record<VerificationStatus, number> {
        const stats: Record<VerificationStatus, number> = {
            verified: 0,
            tampered: 0,
            unsigned: 0,
            unknown: 0,
            verifying: 0
        };
        for (const status of this.verificationStatus.values()) {
            if (stats[status] !== undefined) {
                stats[status]++;
            }
        }
        return stats;
    }

    /**
     * Store an ephemeral capability token [Sprint 4]
     */
    setToken(refId: string, token: any): void {
        this.capabilityTokens.set(refId, token);
    }

    /**
     * Retrieve an ephemeral capability token [Sprint 4]
     */
    getToken(refId: string): any | null {
        return this.capabilityTokens.get(refId) || null;
    }

    /**
     * Clear all ephemeral tokens (e.g., on role switch) [Sprint 4]
     */
    clearTokens(): void {
        this.capabilityTokens.clear();
        console.log('🛡️ [Sprint 4] Ephemeral capability tokens cleared.');
    }

    /**
     * Store metadata for a block
     */
    set(blockId: string, metadata: BlockMetadata): void {
        this.metadata.set(blockId, metadata);
        this.emit('update', [{ blockId, metadata }]);
    }

    /**
     * Retrieve metadata for a block
     * Returns null if not found (safe default)
     */
    get(blockId: string): BlockMetadata | null {
        return this.metadata.get(blockId) || null;
    }

    /**
     * Delete metadata for a block
     */
    delete(blockId: string): void {
        this.metadata.delete(blockId);
    }

    /**
     * Clear all metadata
     */
    clear(): void {
        this.metadata.clear();
    }

    /**
     * Get number of blocks with metadata
     */
    size(): number {
        return this.metadata.size;
    }

    /**
     * List all metadata entries (for debugging)
     */
    listAll(): Array<[string, BlockMetadata]> {
        return Array.from(this.metadata.entries());
    }

    /**
     * Load metadata from backend blocks
     * Extracts metadata from Block[] and stores in shadow map
     */
    loadFromBackend(blocks: Array<{ id: string; data: { metadata: BlockMetadata } }>): void {
        this.clear(); // Start fresh to avoid stale data

        for (const block of blocks) {
            if (block.id && block.data?.metadata) {
                this.set(block.id, block.data.metadata);
            }
        }

        console.log(`[MetadataStore] Loaded ${this.size()} metadata entries from backend`);
    }

    /**
     * Export metadata for backend persistence
     * Returns a Map for easy merging with blocks during save
     */
    exportForBackend(): Map<string, BlockMetadata> {
        return new Map(this.metadata);
    }

    /**
     * Check if metadata exists for a block
     */
    has(blockId: string): boolean {
        return this.metadata.has(blockId);
    }

    /**
     * Batch update metadata for multiple blocks
     */
    setMany(entries: Array<[string, BlockMetadata]>): void {
        for (const [blockId, metadata] of entries) {
            this.set(blockId, metadata);
        }
    }

    /**
     * Get all block IDs that have metadata
     */
    getBlockIds(): string[] {
        return Array.from(this.metadata.keys());
    }

    /**
     * Initialize store from YDoc
     */
    initialize(yDoc: Y.Doc) {
        // Stub for initialization logic if needed
        console.log('MetadataStore initialized with YDoc');
    }

    /**
     * Debug: Log current state
     */
    debug(): void {
        console.log('[MetadataStore] Current state:');
        console.log(`  Total entries: ${this.size()}`);

        const classifications = new Map<string, number>();
        for (const [blockId, metadata] of this.metadata.entries()) {
            const classification = metadata.classification || 'none';
            classifications.set(classification, (classifications.get(classification) || 0) + 1);

            console.log(`  ${blockId}: classification=${classification}, locked=${metadata.locked || false}`);
        }

        console.log('\n  Classification breakdown:');
        for (const [level, count] of classifications.entries()) {
            console.log(`    ${level}: ${count}`);
        }
    }
}
