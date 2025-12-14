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
    | 'chart';

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
 * Block Metadata
 */
export interface BlockMetadata {
    slideIndex?: number | null; // Manual slide assignment
    layout?: 'full-width' | 'split' | 'headline' | 'inline';
    acl?: string[]; // Block IDs this references
    isChunk?: boolean; // True if auto-paginated chunk
    parentId?: string; // Original block ID if chunked
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
    data: Partial<Block['data']> = {}
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

    const metadata = new Y.Map();
    metadata.set('slideIndex', data.metadata?.slideIndex !== undefined ? data.metadata.slideIndex : null);
    metadata.set('layout', data.metadata?.layout || 'full-width');
    metadata.set('acl', data.metadata?.acl || []);

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
 * Updates a block's value
 */
export function updateBlockValue(doc: Y.Doc, blockId: string, newValue: any): void {
    const content = doc.getArray('content');

    for (let i = 0; i < content.length; i++) {
        const block = content.get(i) as Y.Map<any>;
        if (block.get('id') === blockId) {
            const data = block.get('data') as Y.Map<any>;
            data.set('value', newValue);
            block.set('modified', new Date().toISOString());

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
    const data = block.get('data') as Y.Map<any>;
    const metadata = data.get('metadata') as Y.Map<any>;

    return {
        id: block.get('id'),
        type: block.get('type'),
        data: {
            text: data.get('text'),
            value: data.get('value'),
            metadata: {
                slideIndex: metadata.get('slideIndex'),
                layout: metadata.get('layout'),
                acl: metadata.get('acl'),
                isChunk: metadata.get('isChunk'),
                parentId: metadata.get('parentId')
            }
        },
        created: block.get('created'),
        modified: block.get('modified')
    };
}

/**
 * Gets all blocks as JSON array
 */
export function getAllBlocks(doc: Y.Doc): Block[] {
    const content = doc.getArray('content');
    const blocks: Block[] = [];

    for (let i = 0; i < content.length; i++) {
        const block = content.get(i) as Y.Map<any>;
        blocks.push(blockToJSON(block));
    }

    return blocks;
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
 */
function generateUUID(): string {
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
