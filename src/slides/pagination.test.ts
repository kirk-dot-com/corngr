import { describe, it, expect } from 'vitest';
import { paginateBlocks, estimateBlockHeight } from './pagination';
import { Block } from '../yjs/schema';

// Helper to create mock blocks
const createMockBlock = (type: Block['type'], text?: string, metadata: any = {}): Block => ({
    id: 'test-id',
    type,
    data: {
        text,
        metadata,
    },
    created: '',
    modified: '',
});

describe('Pagination Engine', () => {
    describe('estimateBlockHeight', () => {
        it('should estimate height for single line paragraph', () => {
            const block = createMockBlock('paragraph', 'Short text');
            const height = estimateBlockHeight(block);
            expect(height).toBe(24);
        });

        it('should estimate height for multi-line paragraph', () => {
            // > 80 chars
            const text = 'A'.repeat(81);
            const block = createMockBlock('paragraph', text);
            const height = estimateBlockHeight(block);
            expect(height).toBe(48); // 2 lines
        });

        it('should return fixed height for non-text blocks', () => {
            const block = createMockBlock('image');
            expect(estimateBlockHeight(block)).toBe(300);
        });
    });

    describe('paginateBlocks', () => {
        it('should put single block on a slide', () => {
            const blocks = [createMockBlock('paragraph', 'Test')];
            const slides = paginateBlocks(blocks);
            expect(slides.length).toBe(1);
            expect(slides[0].blocks.length).toBe(1);
        });

        it('should respect manual slideIndex', () => {
            const blocks = [
                createMockBlock('paragraph', 'Slide 0', { slideIndex: 0 }),
                createMockBlock('paragraph', 'Slide 1', { slideIndex: 1 }),
            ];
            const slides = paginateBlocks(blocks);
            expect(slides.length).toBe(2);
            expect(slides[0].blocks[0].data.text).toBe('Slide 0');
            expect(slides[1].blocks[0].data.text).toBe('Slide 1');
        });

        it('should auto-paginate when overflow occurs', () => {
            // Create many blocks that exceed slide height
            // Slide height ~920px (1080 - padding)
            // Image = 300px. 4 images = 1200px > 920px
            const blocks = [
                createMockBlock('image'),
                createMockBlock('image'),
                createMockBlock('image'),
                createMockBlock('image'),
            ];

            const slides = paginateBlocks(blocks);
            expect(slides.length).toBe(2);
            expect(slides[0].blocks.length).toBe(3); // 900px
            expect(slides[1].blocks.length).toBe(1); // Overflow to next
        });

        it('should split long text blocks (Sprint 4 Requirement)', () => {
            // Create a very long paragraph that exceeds slide height on its own
            // 400 lines * 24px = 9600px > 920px
            const longText = 'A'.repeat(80 * 400);
            const block = createMockBlock('paragraph', longText);

            const slides = paginateBlocks([block]);
            expect(slides.length).toBeGreaterThan(1);

            // Check first chunk
            expect(slides[0].blocks[0].data.metadata.isChunk).toBe(true);
        });
    });
});
