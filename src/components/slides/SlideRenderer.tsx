import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import './SlideRenderer.css';

interface SlideRendererProps {
    yDoc: Y.Doc;
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({ yDoc }) => {
    const [slides, setSlides] = useState<Array<{ type: string; content: string; level?: number }>>([]);

    useEffect(() => {
        const yXmlFragment = yDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;

        const updateSlides = () => {
            const slideData: Array<{ type: string; content: string; level?: number }> = [];

            // Parse the ProseMirror XML fragment
            yXmlFragment.toArray().forEach((item) => {
                if (item instanceof Y.XmlElement) {
                    const nodeName = item.nodeName;
                    let textContent = '';

                    // Extract text content recursively
                    const extractText = (node: Y.XmlElement | Y.XmlText): string => {
                        if (node instanceof Y.XmlText) {
                            return node.toString();
                        } else if (node instanceof Y.XmlElement) {
                            return node.toArray().map(child => extractText(child)).join('');
                        }
                        return '';
                    };

                    textContent = extractText(item);

                    // Only add blocks with content
                    if (textContent.trim()) {
                        if (nodeName === 'heading') {
                            const level = parseInt(item.getAttribute('level') || '1');
                            slideData.push({
                                type: 'heading',
                                content: textContent,
                                level
                            });
                        } else if (nodeName === 'paragraph') {
                            slideData.push({
                                type: 'paragraph',
                                content: textContent
                            });
                        } else if (nodeName === 'code_block') {
                            slideData.push({
                                type: 'code',
                                content: textContent
                            });
                        } else if (nodeName === 'bullet_list' || nodeName === 'list_item') {
                            slideData.push({
                                type: 'list',
                                content: textContent
                            });
                        }
                    }
                }
            });

            setSlides(slideData);
        };

        updateSlides();
        yXmlFragment.observe(updateSlides);

        return () => {
            yXmlFragment.unobserve(updateSlides);
        };
    }, [yDoc]);

    // Group slides by headings (simple approach: every heading starts a new slide)
    const groupedSlides: Array<Array<{ type: string; content: string; level?: number }>> = [];
    let currentSlide: Array<{ type: string; content: string; level?: number }> = [];

    slides.forEach((block) => {
        if (block.type === 'heading' && block.level === 1) {
            if (currentSlide.length > 0) {
                groupedSlides.push(currentSlide);
            }
            currentSlide = [block];
        } else {
            currentSlide.push(block);
        }
    });

    if (currentSlide.length > 0) {
        groupedSlides.push(currentSlide);
    }

    return (
        <div className="slide-renderer">
            <div className="slide-content">
                {groupedSlides.length === 0 && (
                    <div className="empty-slide">
                        <h2>No Content Yet</h2>
                        <p>Type in the editor to see your content here</p>
                    </div>
                )}
                {groupedSlides.map((slide, slideIndex) => (
                    <div key={slideIndex} className="slide">
                        <div className="slide-number">Slide {slideIndex + 1}</div>
                        {slide.map((block, blockIndex) => {
                            if (block.type === 'heading') {
                                const Tag = `h${block.level || 1}` as keyof JSX.IntrinsicElements;
                                return <Tag key={blockIndex} className="slide-heading">{block.content}</Tag>;
                            } else if (block.type === 'code') {
                                return <pre key={blockIndex} className="slide-code"><code>{block.content}</code></pre>;
                            } else if (block.type === 'list') {
                                return <li key={blockIndex} className="slide-list-item">{block.content}</li>;
                            } else {
                                return <p key={blockIndex} className="slide-text">{block.content}</p>;
                            }
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};
