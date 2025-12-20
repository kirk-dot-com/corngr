import React, { memo } from 'react';
import { Block, BlockMetadata } from '../yjs/schema';
import { formatValue } from '../yjs/schema';
import { PermissionGate } from '../security/PermissionGate';
import { checkClientAccess } from '../security/checkClientAccess';
import { User } from '../security/types';
import './BlockRenderer.css';

interface BlockRendererProps {
    block: Block;
    user: User | null;
    metadata?: BlockMetadata; // Phase 2: From MetadataStore
}

const arePropsEqual = (prev: BlockRendererProps, next: BlockRendererProps) => {
    // Optimization: Only re-render if:
    // 1. The block's content has changed (tracked by modified timestamp)
    // 2. The user context has changed (e.g. role switch)
    // 3. The metadata has changed (classification, ACL, etc.)

    // Check User ID/Role stability
    if (!prev.user && !next.user) return true;
    if (!prev.user || !next.user) return false;

    if (prev.user.id !== next.user.id || prev.user.attributes.role !== next.user.attributes.role) {
        return false;
    }

    // Check Block Identity & Content
    if (prev.block.id !== next.block.id) return false;
    if (prev.block.modified !== next.block.modified) return false;

    // Phase 2: Check metadata changes
    const prevMeta = prev.metadata || prev.block.data.metadata || {};
    const nextMeta = next.metadata || next.block.data.metadata || {};

    if (prevMeta.classification !== nextMeta.classification) return false;
    if (prevMeta.locked !== nextMeta.locked) return false;
    if (prevMeta.isChunk !== nextMeta.isChunk) return false;
    if (prevMeta.slideIndex !== nextMeta.slideIndex) return false;

    return true;
};

/**
 * Classification Badge Component
 * Phase 2: Displays security classification level
 */
const ClassificationBadge: React.FC<{ level: string }> = ({ level }) => (
    <span className={`classification-badge classification-${level.toLowerCase()}`}>
        {level.toUpperCase()}
    </span>
);

/**
 * Renders a single block in the slide view
 * Phase 2: Now supports metadata display and redaction
 */
export const BlockRenderer: React.FC<BlockRendererProps> = memo(({ block, user, metadata }) => {
    const { type, data } = block;
    const effectiveMetadata = metadata || data.metadata;
    const isChunk = effectiveMetadata?.isChunk;

    // Phase 2: Check if user has access to view this block
    const hasAccess = checkClientAccess(user, effectiveMetadata);

    // Phase 2: Render redacted block if no access
    if (!hasAccess) {
        return (
            <div className="redacted-block">
                <div className="redacted-icon">🔒</div>
                <div className="redacted-text">Restricted Content</div>
                {effectiveMetadata?.classification && (
                    <div className="redacted-classification">
                        {effectiveMetadata.classification.toUpperCase()} LEVEL REQUIRED
                    </div>
                )}
            </div>
        );
    }

    const renderContent = () => {
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

    return (
        <PermissionGate user={user} block={block}>
            <div
                className={`slide-block ${isChunk ? 'slide-block-chunk' : ''}`}
                data-classification={effectiveMetadata?.classification}
            >
                {/* Phase 2: Classification Badge */}
                {effectiveMetadata?.classification && (
                    <ClassificationBadge level={effectiveMetadata.classification} />
                )}

                {/* Phase 2: Lock Indicator */}
                {effectiveMetadata?.locked && (
                    <span className="lock-indicator" title="This block is locked for editing">
                        🔒
                    </span>
                )}

                {renderContent()}
            </div>
        </PermissionGate>
    );
}); // Close memo
