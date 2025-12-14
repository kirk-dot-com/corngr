import React from 'react';
import { Block } from '../yjs/schema';
import { formatValue } from '../yjs/schema';
import './BlockRenderer.css';

interface BlockRendererProps {
    block: Block;
}

/**
 * Renders a single block in the slide view
 */
export const BlockRenderer: React.FC<BlockRendererProps> = ({ block }) => {
    const { type, data } = block;

    switch (type) {
        case 'paragraph':
            return <p className="slide-paragraph">{data.text}</p>;

        case 'heading1':
            return <h1 className="slide-heading1">{data.text}</h1>;

        case 'heading2':
            return <h2 className="slide-heading2">{data.text}</h2>;

        case 'variable': {
            const { name, value, format } = data.value || {};
            const layout = data.metadata?.layout || 'inline';
            const formatted = formatValue(value, format);

            if (layout === 'headline') {
                return (
                    <div className="slide-variable-headline">
                        <div className="variable-label">{name}</div>
                        <div className="variable-value">{formatted}</div>
                    </div>
                );
            }

            return (
                <span
                    className="slide-variable-inline"
                    title={`{{${name}}}`}
                >
                    {formatted}
                </span>
            );
        }

        case 'image':
            return (
                <div className="slide-image">
                    <img src={data.value?.src || ''} alt={data.value?.alt || ''} />
                </div>
            );

        case 'chart':
            return (
                <div className="slide-chart">
                    <div className="chart-placeholder">
                        📊 Chart: {data.value?.type || 'unknown'}
                    </div>
                </div>
            );

        default:
            return (
                <div className="slide-block-unknown">
                    Unknown block type: {type}
                </div>
            );
    }
};
