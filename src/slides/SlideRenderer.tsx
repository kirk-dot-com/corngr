import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { getAllBlocks, Block } from '../yjs/schema';
import { BlockRenderer } from './BlockRenderer';
import './SlideRenderer.css';

interface SlideRendererProps {
    yDoc: Y.Doc;
}

interface Slide {
    index: number;
    blocks: Block[];
}

/**
 * Renders Yjs blocks as paginated slides
 */
export const SlideRenderer: React.FC<SlideRendererProps> = ({ yDoc }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    // Subscribe to Yjs content changes
    useEffect(() => {
        const content = yDoc.getArray('content');

        const syncBlocks = () => {
            const allBlocks = getAllBlocks(yDoc);
            setBlocks(allBlocks);
        };

        syncBlocks(); // Initial load
        content.observe(syncBlocks); // Listen to changes

        return () => {
            content.unobserve(syncBlocks);
        };
    }, [yDoc]);

    // Paginate blocks into slides
    const slides = paginateBlocks(blocks);

    const goToNext = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const goToPrevious = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const goToSlide = (index: number) => {
        if (index >= 0 && index < slides.length) {
            setCurrentSlide(index);
        }
    };

    if (slides.length === 0) {
        return (
            <div className="slide-renderer">
                <div className="slide-container">
                    <div className="slide empty-slide">
                        <div className="empty-message">
                            <h1>No content yet</h1>
                            <p>Start typing in the document editor to create slides</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentSlideData = slides[currentSlide];

    return (
        <div className="slide-renderer">
            <div className="slide-container">
                <div className="slide" data-slide-index={currentSlide}>
                    {currentSlideData.blocks.map((block) => (
                        <BlockRenderer key={block.id} block={block} />
                    ))}
                </div>
            </div>

            <div className="slide-controls">
                <button
                    className="nav-btn prev-btn"
                    onClick={goToPrevious}
                    disabled={currentSlide === 0}
                >
                    ← Previous
                </button>

                <div className="slide-indicators">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            className={`indicator ${index === currentSlide ? 'active' : ''}`}
                            onClick={() => goToSlide(index)}
                            aria-label={`Go to slide ${index + 1}`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>

                <button
                    className="nav-btn next-btn"
                    onClick={goToNext}
                    disabled={currentSlide === slides.length - 1}
                >
                    Next →
                </button>
            </div>

            <div className="slide-counter">
                {currentSlide + 1} / {slides.length}
            </div>
        </div>
    );
};

/**
 * Paginate blocks into slides based on slideIndex metadata
 */
function paginateBlocks(blocks: Block[]): Slide[] {
    if (blocks.length === 0) return [];

    const slides: Slide[] = [];
    let currentSlideBlocks: Block[] = [];
    let currentSlideIndex = 0;

    blocks.forEach((block) => {
        const slideIndex = block.data.metadata?.slideIndex;

        // If block has explicit slideIndex, use it
        if (slideIndex !== null && slideIndex !== undefined) {
            // Save current slide if it has blocks
            if (currentSlideBlocks.length > 0) {
                slides.push({
                    index: currentSlideIndex,
                    blocks: currentSlideBlocks
                });
            }

            // Start new slide
            currentSlideIndex = slideIndex;
            currentSlideBlocks = [block];
        } else {
            // Add to current slide
            currentSlideBlocks.push(block);
        }
    });

    // Add final slide
    if (currentSlideBlocks.length > 0) {
        slides.push({
            index: currentSlideIndex,
            blocks: currentSlideBlocks
        });
    }

    return slides;
}
