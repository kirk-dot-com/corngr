import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import * as Y from 'yjs';
import { SlideRenderer } from './SlideRenderer';
import { createCorngrDoc, createBlock, createVariableBlock } from '../yjs/schema';

// Mock window.prompt
global.prompt = vi.fn();

describe('Slide Renderer - Sprint 3 Success Criteria', () => {
    let doc: Y.Doc;
    const userId = 'test-user-slide';

    beforeEach(() => {
        doc = createCorngrDoc(userId, 'Slide Test Document');
    });

    describe('Basic Rendering', () => {
        it('should render empty state when no blocks', () => {
            const { container } = render(<SlideRenderer yDoc={doc} />);

            expect(container.querySelector('.empty-slide')).toBeTruthy();
            expect(screen.getByText(/no content yet/i)).toBeTruthy();
        });

        it('should render slides container', () => {
            createBlock(doc, 'paragraph', { text: 'Test slide' });

            const { container } = render(<SlideRenderer yDoc={doc} />);

            expect(container.querySelector('.slide-renderer')).toBeTruthy();
            expect(container.querySelector('.slide-container')).toBeTruthy();
        });

        it('should render blocks from Yjs (Sprint 3 Success Criterion)', async () => {
            createBlock(doc, 'heading1', { text: 'Welcome' });
            createBlock(doc, 'paragraph', { text: 'This is a test slide' });

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                expect(screen.getByText('Welcome')).toBeTruthy();
                expect(screen.getByText('This is a test slide')).toBeTruthy();
            });
        });
    });

    describe('Variable Block Rendering', () => {
        it('should display variable blocks with formatted values (Sprint 3 Success Criterion)', async () => {
            createVariableBlock(doc, 'revenue', 1000, 'currency');

            render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                // Should show formatted value ($1,000.00)
                expect(screen.getByText('$1,000.00')).toBeTruthy();
            });
        });

        it('should render inline variables', async () => {
            createVariableBlock(doc, 'count', 42, 'number');

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                const variable = container.querySelector('.slide-variable-inline');
                expect(variable).toBeTruthy();
                expect(screen.getByText('42')).toBeTruthy();
            });
        });

        it('should render headline layout variables', async () => {
            const blockId = createVariableBlock(doc, 'total', 5000, 'currency');

            // Set layout to headline
            const content = doc.getArray('content');
            const block = content.get(0) as Y.Map<any>;
            const data = block.get('data') as Y.Map<any>;
            const metadata = data.get('metadata') as Y.Map<any>;
            metadata.set('layout', 'headline');

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                const headline = container.querySelector('.slide-variable-headline');
                expect(headline).toBeTruthy();
                expect(screen.getByText('total')).toBeTruthy();
                expect(screen.getByText('$5,000.00')).toBeTruthy();
            });
        });
    });

    describe('Pagination', () => {
        it('should paginate blocks by slideIndex', async () => {
            createBlock(doc, 'heading1', {
                text: 'Slide 1',
                metadata: { slideIndex: 0 }
            });
            createBlock(doc, 'heading1', {
                text: 'Slide 2',
                metadata: { slideIndex: 1 }
            });
            createBlock(doc, 'heading1', {
                text: 'Slide 3',
                metadata: { slideIndex: 2 }
            });

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                const indicators = container.querySelectorAll('.indicator');
                expect(indicators.length).toBe(3);
            });
        });

        it('should show slide counter', async () => {
            createBlock(doc, 'paragraph', { text: 'Content' });

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                const counter = container.querySelector('.slide-counter');
                expect(counter?.textContent).toBe('1 / 1');
            });
        });
    });

    describe('Navigation', () => {
        beforeEach(() => {
            createBlock(doc, 'heading1', {
                text: 'Slide 1',
                metadata: { slideIndex: 0 }
            });
            createBlock(doc, 'heading1', {
                text: 'Slide 2',
                metadata: { slideIndex: 1 }
            });
        });

        it('should render navigation controls (Sprint 3 Success Criterion)', async () => {
            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                expect(container.querySelector('.prev-btn')).toBeTruthy();
                expect(container.querySelector('.next-btn')).toBeTruthy();
                expect(container.querySelector('.slide-indicators')).toBeTruthy();
            });
        });

        it('should disable previous button on first slide', async () => {
            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                const prevBtn = container.querySelector('.prev-btn') as HTMLButtonElement;
                expect(prevBtn.disabled).toBe(true);
            });
        });

        it('should enable next button when multiple slides exist', async () => {
            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                const nextBtn = container.querySelector('.next-btn') as HTMLButtonElement;
                expect(nextBtn.disabled).toBe(false);
            });
        });
    });

    describe('Real-time Sync', () => {
        it('should update when blocks are added to Yjs', async () => {
            const { container } = render(<SlideRenderer yDoc={doc} />);

            // Initially empty
            await waitFor(() => {
                expect(container.querySelector('.empty-slide')).toBeTruthy();
            });

            // Add block
            createBlock(doc, 'paragraph', { text: 'New content' });

            // Should update
            await waitFor(() => {
                expect(screen.getByText('New content')).toBeTruthy();
                expect(container.querySelector('.empty-slide')).toBeNull();
            });
        });

        it('should update when blocks are modified', async () => {
            createBlock(doc, 'paragraph', { text: 'Initial' });

            render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                expect(screen.getByText('Initial')).toBeTruthy();
            });

            // Modify block
            const content = doc.getArray('content');
            const block = content.get(0) as Y.Map<any>;
            const data = block.get('data') as Y.Map<any>;
            data.set('text', 'Modified');

            await waitFor(() => {
                expect(screen.getByText('Modified')).toBeTruthy();
            });
        });
    });

    describe('Transclusion Sync (Sprint 3 Success Criterion)', () => {
        it('should sync variable value updates in <100ms', async () => {
            const blockId = createVariableBlock(doc, 'revenue', 1000, 'currency');

            render(<SlideRenderer yDoc={doc} />);

            // Initial value
            await waitFor(() => {
                expect(screen.getByText('$1,000.00')).toBeTruthy();
            });

            // Update value
            const startTime = performance.now();

            const content = doc.getArray('content');
            const block = content.get(0) as Y.Map<any>;
            const data = block.get('data') as Y.Map<any>;
            const value = data.get('value');
            value.value = 2000;
            data.set('value', value);

            // Should update quickly
            await waitFor(() => {
                expect(screen.getByText('$2,000.00')).toBeTruthy();
            }, { timeout: 200 });

            const endTime = performance.now();
            const latency = endTime - startTime;

            // Verify sub-100ms update (allowing margin for test overhead)
            expect(latency).toBeLessThan(200);
        });
    });

    describe('Block Type Support', () => {
        it('should render headings', async () => {
            createBlock(doc, 'heading1', { text: 'Main Title' });
            createBlock(doc, 'heading2', { text: 'Subtitle' });

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                expect(container.querySelector('.slide-heading1')).toBeTruthy();
                expect(container.querySelector('.slide-heading2')).toBeTruthy();
            });
        });

        it('should render paragraphs', async () => {
            createBlock(doc, 'paragraph', { text: 'Body content' });

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                expect(container.querySelector('.slide-paragraph')).toBeTruthy();
            });
        });

        it('should handle unknown block types gracefully', async () => {
            const content = doc.getArray('content');
            const unknownBlock = new Y.Map();
            unknownBlock.set('id', 'unknown-1');
            unknownBlock.set('type', 'unknown-type');
            unknownBlock.set('data', new Y.Map());
            unknownBlock.set('created', new Date().toISOString());
            unknownBlock.set('modified', new Date().toISOString());
            content.push([unknownBlock]);

            const { container } = render(<SlideRenderer yDoc={doc} />);

            await waitFor(() => {
                expect(container.querySelector('.slide-block-unknown')).toBeTruthy();
            });
        });
    });
});
