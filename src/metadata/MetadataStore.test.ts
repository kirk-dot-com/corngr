import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataStore } from './MetadataStore';
import { BlockMetadata } from '../yjs/schema';

describe('MetadataStore', () => {
    let store: MetadataStore;

    beforeEach(() => {
        store = new MetadataStore();
    });

    describe('Basic CRUD Operations', () => {
        it('should store and retrieve metadata', () => {
            const metadata: BlockMetadata = {
                classification: 'confidential',
                slideIndex: null,
                layout: 'full-width'
            };

            store.set('block-123', metadata);
            const retrieved = store.get('block-123');

            expect(retrieved).toEqual(metadata);
        });

        it('should return null for non-existent blocks', () => {
            const result = store.get('non-existent-id');
            expect(result).toBeNull();
        });

        it('should delete metadata', () => {
            store.set('block-123', { classification: 'public' });
            expect(store.has('block-123')).toBe(true);

            store.delete('block-123');
            expect(store.has('block-123')).toBe(false);
            expect(store.get('block-123')).toBeNull();
        });

        it('should clear all metadata', () => {
            store.set('block-1', { classification: 'public' });
            store.set('block-2', { classification: 'confidential' });

            expect(store.size()).toBe(2);

            store.clear();
            expect(store.size()).toBe(0);
            expect(store.get('block-1')).toBeNull();
        });

        it('should report correct size', () => {
            expect(store.size()).toBe(0);

            store.set('block-1', { classification: 'public' });
            expect(store.size()).toBe(1);

            store.set('block-2', { classification: 'internal' });
            expect(store.size()).toBe(2);

            store.delete('block-1');
            expect(store.size()).toBe(1);
        });
    });

    describe('Batch Operations', () => {
        it('should set multiple metadata entries at once', () => {
            const entries: Array<[string, BlockMetadata]> = [
                ['block-1', { classification: 'public' }],
                ['block-2', { classification: 'confidential' }],
                ['block-3', { classification: 'restricted' }]
            ];

            store.setMany(entries);

            expect(store.size()).toBe(3);
            expect(store.get('block-1')?.classification).toBe('public');
            expect(store.get('block-2')?.classification).toBe('confidential');
            expect(store.get('block-3')?.classification).toBe('restricted');
        });

        it('should list all metadata entries', () => {
            store.set('block-1', { classification: 'public' });
            store.set('block-2', { classification: 'internal' });

            const all = store.listAll();

            expect(all).toHaveLength(2);
            expect(all.some(([id]) => id === 'block-1')).toBe(true);
            expect(all.some(([id]) => id === 'block-2')).toBe(true);
        });

        it('should get all block IDs', () => {
            store.set('block-1', { classification: 'public' });
            store.set('block-2', { classification: 'internal' });
            store.set('block-3', { classification: 'confidential' });

            const ids = store.getBlockIds();

            expect(ids).toHaveLength(3);
            expect(ids).toContain('block-1');
            expect(ids).toContain('block-2');
            expect(ids).toContain('block-3');
        });
    });

    describe('Backend Sync', () => {
        it('should load metadata from backend blocks', () => {
            const blocks = [
                {
                    id: 'block-1',
                    type: 'paragraph' as const,
                    data: {
                        text: 'Public content',
                        metadata: {
                            classification: 'public' as const,
                            slideIndex: null,
                            layout: 'full-width' as const
                        }
                    },
                    created: '2025-01-01',
                    modified: '2025-01-01'
                },
                {
                    id: 'block-2',
                    type: 'heading1' as const,
                    data: {
                        text: 'Confidential Data',
                        metadata: {
                            classification: 'confidential' as const,
                            locked: true,
                            slideIndex: null,
                            layout: 'full-width' as const
                        }
                    },
                    created: '2025-01-01',
                    modified: '2025-01-01'
                }
            ];

            store.loadFromBackend(blocks);

            expect(store.size()).toBe(2);
            expect(store.get('block-1')?.classification).toBe('public');
            expect(store.get('block-2')?.classification).toBe('confidential');
            expect(store.get('block-2')?.locked).toBe(true);
        });

        it('should clear existing metadata when loading from backend', () => {
            // Setup: existing metadata
            store.set('old-block', { classification: 'public' });
            expect(store.size()).toBe(1);

            // Load new metadata from backend
            const blocks = [
                {
                    id: 'new-block',
                    type: 'paragraph' as const,
                    data: {
                        text: 'New content',
                        metadata: {
                            classification: 'internal' as const
                        }
                    },
                    created: '2025-01-01',
                    modified: '2025-01-01'
                }
            ];

            store.loadFromBackend(blocks);

            // Old metadata should be gone
            expect(store.size()).toBe(1);
            expect(store.has('old-block')).toBe(false);
            expect(store.has('new-block')).toBe(true);
        });

        it('should export metadata for backend persistence', () => {
            store.set('block-1', { classification: 'public' });
            store.set('block-2', { classification: 'confidential', locked: true });

            const exported = store.exportForBackend();

            expect(exported).toBeInstanceOf(Map);
            expect(exported.size).toBe(2);
            expect(exported.get('block-1')?.classification).toBe('public');
            expect(exported.get('block-2')?.classification).toBe('confidential');
            expect(exported.get('block-2')?.locked).toBe(true);
        });

        it('should handle round-trip (load → export)', () => {
            const originalBlocks = [
                {
                    id: 'block-1',
                    type: 'paragraph' as const,
                    data: {
                        text: 'Test',
                        metadata: {
                            classification: 'restricted' as const,
                            acl: ['admin-role'],
                            layout: 'full-width' as const
                        }
                    },
                    created: '2025-01-01',
                    modified: '2025-01-01'
                }
            ];

            // Load
            store.loadFromBackend(originalBlocks);

            // Export
            const exported = store.exportForBackend();

            // Verify data integrity
            expect(exported.get('block-1')?.classification).toBe('restricted');
            expect(exported.get('block-1')?.acl).toEqual(['admin-role']);
        });
    });

    describe('Edge Cases', () => {
        it('should handle blocks without metadata gracefully', () => {
            const blocks = [
                {
                    id: 'block-1',
                    type: 'paragraph' as const,
                    data: {
                        text: 'Content',
                        metadata: undefined as any // Missing metadata
                    },
                    created: '2025-01-01',
                    modified: '2025-01-01'
                }
            ];

            // Should not throw
            expect(() => store.loadFromBackend(blocks)).not.toThrow();
        });

        it('should handle empty blocks array', () => {
            store.set('existing', { classification: 'public' });

            store.loadFromBackend([]);

            expect(store.size()).toBe(0);
        });

        it('should overwrite existing metadata when setting', () => {
            store.set('block-1', { classification: 'public' });
            expect(store.get('block-1')?.classification).toBe('public');

            store.set('block-1', { classification: 'confidential', locked: true });

            expect(store.get('block-1')?.classification).toBe('confidential');
            expect(store.get('block-1')?.locked).toBe(true);
        });
    });

    describe('Security Metadata Fields', () => {
        it('should store all metadata fields correctly', () => {
            const fullMetadata: BlockMetadata = {
                slideIndex: 2,
                layout: 'split',
                acl: ['user-123', 'role-editor'],
                isChunk: false,
                parentId: undefined,
                classification: 'restricted',
                locked: true,
                provenance: {
                    sourceId: 'original-block',
                    authorId: 'user-456',
                    timestamp: '2025-01-01T10:00:00Z'
                }
            };

            store.set('block-with-full-metadata', fullMetadata);
            const retrieved = store.get('block-with-full-metadata');

            expect(retrieved).toEqual(fullMetadata);
            expect(retrieved?.provenance?.authorId).toBe('user-456');
        });
    });
});
