import * as Y from 'yjs';

/**
 * Corngr Block Types
 */
export type BlockType =
    | 'paragraph'
    | 'heading1'
    | 'heading2'
    | 'variable'
    | 'image'
    | 'chart'
    | 'inline-reference'; // [EIM] New type for inline transclusions

/**
 * Permission Rule for ABAC
 */
export interface PermissionRule {
    subject: string; // user_uuid or role_name
    action: 'read' | 'write' | 'admin';
    resource: string; // block_id or '*'
    conditions?: Record<string, any>; // ABAC attributes
}

/**
 * [EIM] Data Lineage / Provenance
 * Tracks the origin of a data point for "X-Ray" features.
 */
export interface Provenance {
    sourceId: string; // ID of the original block/cell
    sourceDocId?: string; // [Sprint 3] Origin Document ID
    authorId: string; // User who last modified the source
    timestamp: string; // When the source was last modified
    originUrl?: string; // [Sprint 3] Origin URL/Path
    signature?: string; // Opt: Content hash for immutable verification
    history?: { // Short history of last 3 hops
        blockId: string;
        timestamp: string;
    }[];
}

/**
 * [EIM] Inline Reference Data
 * Used for embedding live data inside text.
 */
export interface InlineRefData {
    referencedBlockId: string;
    field: string; // e.g., 'value', 'data.value', 'metadata.status'
    fallbackText: string; // Shown if reference is broken
}

/**
 * Block Metadata
 */
export interface BlockMetadata {
    slideIndex?: number | null; // Manual slide assignment
    layout?: 'full-width' | 'split' | 'headline' | 'inline';
    acl?: string[]; // Block IDs this references
    isChunk?: boolean; // True if auto-paginated chunk
    parentId?: string; // Original block ID if chunked

    // [EIM] Governance Fields
    provenance?: Provenance;
    classification?: 'public' | 'internal' | 'confidential' | 'restricted';
    locked?: boolean; // If true, requires special permission to edit

    // [Sprint 3] Cross-Origin Governance
    originDocId?: string;
    originUrl?: string;
}

/**
 * Variable Block Data
 */
export interface VariableBlockData {
    name: string;
    value: any;
    format?: 'currency' | 'percentage' | 'number' | 'text';
}

/**
 * Generic Block Structure
 */
export interface Block {
    id: string;
    type: BlockType;
    data: {
        text?: string; // For text-based blocks
        value?: any; // For structured data (variables, charts)
        inlineRef?: InlineRefData; // [EIM] For inline reference blocks
        metadata: BlockMetadata;
    };
    created: string;
    modified: string;
}

/**
 * Creates a new Corngr Y.Doc with the proper schema structure
 */
export function createCorngrDoc(ownerId: string, title: string = 'Untitled'): Y.Doc {
    const doc = new Y.Doc();

    // Meta information
    const meta = doc.getMap('meta');
    meta.set('id', generateUUID());
    meta.set('title', title);
    meta.set('created', new Date().toISOString());
    meta.set('modified', new Date().toISOString());
    meta.set('owner', ownerId);

    // Permissions array
    const permissions = doc.getArray('permissions');

    // Default permission: owner has admin access
    const ownerPermission = new Y.Map();
    ownerPermission.set('subject', ownerId);
    ownerPermission.set('action', 'admin');
    ownerPermission.set('resource', '*');
    permissions.push([ownerPermission]);

    // Content array (blocks)
    doc.getArray('content');

    return doc;
}

/**
 * Creates a block and adds it to the Y.Doc
 */
export function createBlock(
    doc: Y.Doc,
    type: BlockType,
    data: Partial<Block['data']> = {},
    provenance?: Provenance
): string {
    const content = doc.getArray('content');
    const blockId = generateUUID();

    const block = new Y.Map();
    block.set('id', blockId);
    block.set('type', type);
    block.set('created', new Date().toISOString());
    block.set('modified', new Date().toISOString());

    const blockData = new Y.Map();
    blockData.set('text', data.text || '');
    blockData.set('value', data.value || null);

    if (data.inlineRef) {
        blockData.set('inlineRef', data.inlineRef);
    }

    const metadata = new Y.Map();
    metadata.set('slideIndex', data.metadata?.slideIndex !== undefined ? data.metadata.slideIndex : null);
    metadata.set('layout', data.metadata?.layout || 'full-width');
    metadata.set('acl', data.metadata?.acl || []);

    // [EIM] Set Governance Metdata
    if (provenance) metadata.set('provenance', provenance);
    if (data.metadata?.classification) metadata.set('classification', data.metadata.classification);
    if (data.metadata?.locked) metadata.set('locked', data.metadata.locked);

    blockData.set('metadata', metadata);
    block.set('data', blockData);

    content.push([block]);

    // Update document modified time
    const meta = doc.getMap('meta');
    meta.set('modified', new Date().toISOString());

    return blockId;
}

/**
 * Creates a variable block
 */
export function createVariableBlock(
    doc: Y.Doc,
    name: string,
    value: any,
    format: VariableBlockData['format'] = 'text'
): string {
    return createBlock(doc, 'variable', {
        value: { name, value, format },
        metadata: {
            layout: 'inline'
        }
    });
}

/**
 * [EIM] Creates an inline reference block (transclusion)
 */
export function createInlineReference(
    doc: Y.Doc,
    targetBlockId: string,
    field: string,
    fallbackText: string,
    provenance: Provenance
): string {
    return createBlock(doc, 'inline-reference', {
        inlineRef: {
            referencedBlockId: targetBlockId,
            field,
            fallbackText
        },
        metadata: {
            layout: 'inline'
        }
    }, provenance);
}

/**
 * Updates a block's value
 */
export function updateBlockValue(doc: Y.Doc, blockId: string, newValue: any, modifierUserId?: string): void {
    const content = doc.getArray('content');

    for (let i = 0; i < content.length; i++) {
        const block = content.get(i) as Y.Map<any>;
        if (block.get('id') === blockId) {
            const data = block.get('data') as Y.Map<any>;
            const type = block.get('type') as BlockType;

            // [EIM] Unified Update Logic
            if (type === 'paragraph' || type === 'heading1' || type === 'heading2') {
                data.set('text', typeof newValue === 'string' ? newValue : JSON.stringify(newValue));
            } else {
                data.set('value', newValue);
            }

            block.set('modified', new Date().toISOString());

            // [EIM] Update Provenance if modifier provided
            if (modifierUserId) {
                const metadata = data.get('metadata') as Y.Map<any>;
                const currentProv = metadata.get('provenance') || {};
                metadata.set('provenance', {
                    ...currentProv,
                    authorId: modifierUserId,
                    timestamp: new Date().toISOString()
                });
            }

            // Update doc modified time
            const meta = doc.getMap('meta');
            meta.set('modified', new Date().toISOString());
            break;
        }
    }
}

/**
 * Retrieves a block by ID
 */
export function getBlock(doc: Y.Doc, blockId: string): Y.Map<any> | null {
    const content = doc.getArray('content');

    for (let i = 0; i < content.length; i++) {
        const block = content.get(i) as Y.Map<any>;
        if (block.get('id') === blockId) {
            return block;
        }
    }

    return null;
}

/**
 * Converts Y.Map block to plain JSON
 */
export function blockToJSON(block: Y.Map<any>): Block {
    const data = block.get('data') as Y.Map<any> | undefined;
    const metadata = data?.get('metadata') as Y.Map<any> | undefined;

    return {
        id: block.get('id') || 'unknown',
        type: block.get('type') || 'paragraph',
        data: {
            text: data?.get('text') || '',
            value: data?.get('value') || null,
            inlineRef: data?.get('inlineRef') || undefined,
            metadata: {
                slideIndex: metadata?.get('slideIndex') ?? null,
                layout: metadata?.get('layout') || 'full-width',
                acl: metadata?.get('acl') || [],
                isChunk: metadata?.get('isChunk') || false,
                parentId: metadata?.get('parentId') || undefined,

                // [EIM]
                provenance: metadata?.get('provenance') || undefined,
                classification: metadata?.get('classification') || undefined,
                locked: metadata?.get('locked') || false
            }
        },
        created: block.get('created') || new Date().toISOString(),
        modified: block.get('modified') || new Date().toISOString()
    };
}

/**
 * Gets all blocks as JSON array from the Prosemirror Fragment
 * This bridges the Y.XmlFragment (Editor) to the Block[] (Slides/Persistence)
 * 
 * Phase 2: Now preserves stable block IDs from ProseMirror nodes
 */
export function getAllBlocks(doc: Y.Doc): Block[] {
    // Priority 1: Prosemirror Fragment (Live Editor State)
    const fragment = doc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
    const blocks: Block[] = [];

    if (fragment && fragment.length > 0) {
        // Iterate over top-level nodes (paragraphs, headings)
        for (const node of fragment.toArray()) {
            if (node instanceof Y.XmlElement) {
                const nodeName = node.nodeName;
                const attrs = node.getAttributes();

                // Phase 2: Extract stable block ID or generate one
                const blockId = attrs.blockId || generateUUID();

                // Extract text content by iterating children
                let text = '';
                // node.toString() can be buggy for deep observation updates in real-time
                // Iterate children to get live text content
                const length = node.length;
                for (let i = 0; i < length; i++) {
                    const child = node.get(i);
                    if (child instanceof Y.XmlText) {
                        text += child.toString();
                    } else if (child instanceof Y.XmlElement) {
                        // Recursive text extraction for nested nodes might be needed, 
                        // but for basic Paragraph/Heading in ProseMirror, text is usually direct child or wrapped in marks.
                        // For now, let's trust toString() on the child or skip complex nesting for slides.
                        text += child.toString();
                    } else {
                        text += String(child);
                    }
                }

                // Fallback if empty and length > 0 (e.g. sometimes mapped differently)
                if (!text && length > 0) {
                    text = node.toString();
                }

                let blockType: BlockType = 'paragraph';
                let metadata: BlockMetadata = {
                    slideIndex: null, // Default to flow
                    layout: 'full-width'
                };

                // Map Node Types
                if (nodeName === 'paragraph') {
                    blockType = 'paragraph';
                } else if (nodeName === 'heading') {
                    const level = attrs.level || 1;
                    blockType = level === 1 ? 'heading1' : 'heading2';
                } else if (nodeName === 'variable') {
                    blockType = 'variable';
                }

                blocks.push({
                    id: blockId,
                    type: blockType,
                    // @ts-ignore
                    type_: blockType,
                    data: {
                        text: text,
                        value: null,
                        metadata: metadata
                    },
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                });
            }
        }
        return blocks;
    }

    // Priority 2: Legacy Content Array (used in Unit Tests and Phase 0/1 headless loads)
    const content = doc.getArray('content');
    if (content && content.length > 0) {
        return content.toArray().map((blockMap: any) => {
            const block = blockToJSON(blockMap as Y.Map<any>);
            // Ensure type_ for Rust
            return {
                ...block,
                // @ts-ignore
                type_: block.type
            };
        });
    }

    return [];
}

/**
 * Adds a permission rule to the document
 */
export function addPermission(
    doc: Y.Doc,
    subject: string,
    action: PermissionRule['action'],
    resource: string = '*',
    conditions?: Record<string, any>
): void {
    const permissions = doc.getArray('permissions');

    const rule = new Y.Map();
    rule.set('subject', subject);
    rule.set('action', action);
    rule.set('resource', resource);
    if (conditions) {
        rule.set('conditions', conditions);
    }

    permissions.push([rule]);
}

/**
 * Simple UUID generator (v4)
 * Exported for use in Phase 2 (stable block IDs)
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Formats a value based on its format type
 */
export function formatValue(value: any, format?: VariableBlockData['format']): string {
    if (value === null || value === undefined) return '';

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(value);

        case 'percentage':
            return `${(value * 100).toFixed(2)}%`;

        case 'number':
            return new Intl.NumberFormat('en-US').format(value);

        case 'text':
        default:
            return String(value);
    }
}
