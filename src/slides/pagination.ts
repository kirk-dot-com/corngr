import { Block } from '../yjs/schema';

export interface Slide {
    index: number;
    blocks: Block[];
}

const SLIDE_HEIGHT = 1080;
const PADDING = 80;
const MAX_CONTENT_HEIGHT = SLIDE_HEIGHT - (PADDING * 2); // 920px

const BASE_HEIGHTS: Record<string, number> = {
    'paragraph': 24,
    'heading1': 72,
    'heading2': 54,
    'variable': 48,
    'chart': 400,
    'image': 300
};

/**
 * Estimates the pixel height of a block
 */
export function estimateBlockHeight(block: Block): number {
    const base = BASE_HEIGHTS[block.type] || 24;

    if (block.type === 'paragraph') {
        const text = block.data.text || '';
        const charCount = text.length;
        if (charCount === 0) return base;

        const lines = Math.ceil(charCount / 80); // Assume 80 chars per line
        return Math.max(lines * base, base);
    }

    return base;
}

/**
 * Splits a text block into chunks to fit available height
 */
export function splitTextBlock(block: Block, availableHeight: number): Block[] {
    if (block.type !== 'paragraph' || !block.data.text) {
        return [block];
    }

    const lineHeight = BASE_HEIGHTS['paragraph'];
    const maxLines = Math.floor(availableHeight / lineHeight);

    // If we can't fit even one line properly, push purely to next slide
    // But for the recursive algorithm to work, we might need a minimum.
    // Let's assume minimum 1 line.

    const text = block.data.text;
    const charsPerLine = 80;
    const splitIndex = maxLines * charsPerLine;

    if (splitIndex >= text.length) {
        return [block];
    }

    // First chunk
    const firstText = text.substring(0, splitIndex);
    const firstChunk: Block = {
        ...block,
        id: `${block.id}_chunk_0`,
        data: {
            ...block.data,
            text: firstText,
            metadata: {
                ...block.data.metadata,
                isChunk: true,
                parentId: block.id
            }
        }
    };

    // Remaining text - might be huge, so we need to recursively split or just return as one big chunk 
    // that will be handled by the main loop (it handles the "does it fit" check).
    // Actually simplicity: Just return the rest as a new block, and let the main loop handle it?
    // The main loop iterates blocks. If we return 2 blocks here, we need to inject them back?
    // Better: Helper returns [fittedChunk, remainingBlock]

    const remainingText = text.substring(splitIndex);
    const remainingBlock: Block = {
        ...block,
        id: `${block.id}_chunk_rest`, // Main loop will rename/process this if needed? 
        // Actually, let's keep it simpler for now and assume single split or let logic handle.
        data: {
            ...block.data,
            text: remainingText,
            metadata: {
                ...block.data.metadata,
                isChunk: true,
                parentId: block.id
            }
        }
    };

    return [firstChunk, remainingBlock];
}


/**
 * Paginates blocks into slides handling spillover
 */
export function paginateBlocks(blocks: Block[]): Slide[] {
    const slides: Slide[] = [];
    let currentSlideIndex = 0;
    let currentSlideBlocks: Block[] = [];
    let currentHeight = 0;

    const finalizeSlide = () => {
        if (currentSlideBlocks.length > 0) {
            slides.push({
                index: currentSlideIndex,
                blocks: [...currentSlideBlocks]
            });
            currentSlideBlocks = [];
            currentHeight = 0;
            currentSlideIndex++; // Default increment
        }
    };

    // We need to process blocks in a queue because splitting might add new blocks
    const queue = [...blocks];
    let i = 0;

    while (i < queue.length) {
        const block = queue[i];

        // 1. Check for Manual Override
        const manualIndex = block.data.metadata?.slideIndex;
        if (manualIndex !== undefined && manualIndex !== null) {
            // If we are currently building a slide and this block wants a DIFFERENT index
            // we must finalize the current one.
            // Also need to handle if we are *already* on that index?

            // Simplification: logic from the plan
            // "If block has explicit slideIndex, use it"

            if (currentSlideIndex !== manualIndex && currentSlideBlocks.length > 0) {
                finalizeSlide();
            }
            currentSlideIndex = manualIndex;

            // Note: Manual blocks might OVERFLOW the manual slide. 
            // The requirement implies manual override forces the START of the block.
            // But if it overflows, does it spill to manualIndex + 1?
            // "If block has explicit slideIndex... use it"
            // Let's assume we reset height check for manual slide start.
        }

        const blockHeight = estimateBlockHeight(block);

        // 2. Check if fits
        if (currentHeight + blockHeight <= MAX_CONTENT_HEIGHT) {
            currentSlideBlocks.push(block);
            currentHeight += blockHeight;
            i++;
        } else {
            // 3. Overflow

            // Can we split it?
            if (block.type === 'paragraph' && blockHeight > MAX_CONTENT_HEIGHT) {
                // Even on a fresh slide it wouldn't fit, OR it just doesn't fit here.
                // We should try to fill the CURRENT slide with a chunk
                const remainingInSlide = MAX_CONTENT_HEIGHT - currentHeight;

                // Minimum height to bother splitting? Say 24px
                if (remainingInSlide >= 24) {
                    const [chunk, rest] = splitTextBlock(block, remainingInSlide);

                    // Add chunk to current
                    currentSlideBlocks.push(chunk);
                    finalizeSlide(); // Slide is full now

                    // Re-queue the rest
                    queue[i] = rest; // Replace current block with the rest
                    // Do NOT increment i, process 'rest' in next iteration
                } else {
                    // Too little space, just move to next slide
                    finalizeSlide();
                    // Do NOT increment i, retry block on new slide
                }
            } else {
                // Not splittable (image/chart) or just normal overflow
                finalizeSlide();
                // Do NOT increment i, retry block on new slide
            }
        }
    }

    // Finalize last slide
    if (currentSlideBlocks.length > 0) {
        slides.push({
            index: currentSlideIndex,
            blocks: currentSlideBlocks
        });
    }

    return slides;
}
