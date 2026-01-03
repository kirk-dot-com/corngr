import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import './SlideRenderer.css';

interface SlideRendererProps {
    yDoc: Y.Doc;
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({ yDoc }) => {
    // Basic Stub for Slide Renderer
    const [slides, setSlides] = useState<any[]>([]);

    useEffect(() => {
        // Mock observing content
        const update = () => {
            const content = yDoc.getArray('content');
            // Mock transformation of blocks to slides
            setSlides(content.toArray());
        };
        update();
        yDoc.getArray('content').observe(update);
    }, [yDoc]);

    return (
        <div className="slide-renderer">
            <div className="slide-content">
                <h2>Slide View (Stub)</h2>
                <div className="slides-container">
                    {slides.length === 0 && <p>No content to display.</p>}
                    {slides.map((block: any, i) => (
                        <div key={i} className="slide-block">
                            {JSON.stringify(block)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
