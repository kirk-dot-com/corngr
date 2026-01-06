import React, { useEffect, useState, useLayoutEffect } from 'react';
import * as Y from 'yjs';
import { getAllBlocks, Block } from '../yjs/schema';
import { BlockRenderer } from './BlockRenderer';
import { paginateBlocks } from './pagination';
import { User } from '../security/types';
import { recordRender } from '../components/PerformanceMonitor';
import './SlideRenderer.css';

interface SlideRendererProps {
    yDoc: Y.Doc;
    user?: User | null;
}

const DEFAULT_USER: User = {
    id: 'default-admin',
    name: 'Admin',
    role: 'admin',
    color: '#FF0000',
    attributes: { role: 'admin' }
};

/**
 * Renders Yjs blocks as paginated slides
 */
export const SlideRenderer: React.FC<SlideRendererProps> = ({ yDoc, user = DEFAULT_USER }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    // Subscribe to Yjs content changes
    useEffect(() => {
        const fragment = yDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
        const content = yDoc.getArray('content');

        const syncBlocks = () => {
            const allBlocks = getAllBlocks(yDoc);
            setBlocks(allBlocks);
        };

        syncBlocks(); // Initial load

        // Observe both sources
        fragment.observeDeep(syncBlocks);
        content.observeDeep(syncBlocks);

        return () => {
            fragment.unobserveDeep(syncBlocks);
            content.unobserveDeep(syncBlocks);
        };
    }, [yDoc]);

    // Paginate blocks into slides using new engine
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

    // Auto-adjust current slide if it disappears (e.g., content deleted)
    useEffect(() => {
        if (currentSlide >= slides.length && slides.length > 0) {
            setCurrentSlide(slides.length - 1);
        }
    }, [slides.length, currentSlide]);

    // PERF: Record render timing
    useLayoutEffect(() => {
        recordRender();
    });

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
                <div className="slide" data-slide-index={currentSlideData.index}>
                    {/* Debug Info Overlay */}
                    <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, color: '#ccc' }}>
                        Slide Index: {currentSlideData.index} (Render Index: {currentSlide})
                    </div>

                    {currentSlideData.blocks.map((block) => (
                        <BlockRenderer key={`${block.id}_${block.modified}`} block={block} user={user} />
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
                    {slides.map((slide, i) => (
                        <button
                            key={i}
                            className={`indicator ${i === currentSlide ? 'active' : ''}`}
                            onClick={() => goToSlide(i)}
                            aria-label={`Go to slide ${i + 1}`}
                            title={`Slide ${slide.index}`}
                        >
                            {i + 1}
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
