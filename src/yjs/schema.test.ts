import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
    createCorngrDoc,
    createBlock,
    createVariableBlock,
    updateBlockValue,
    getBlock,
    getAllBlocks,
    addPermission,
    formatValue,
    blockToJSON
} from './schema';

describe('Yjs Schema - Sprint 1 Success Criteria', () => {
    let doc: Y.Doc;
    const userId = 'user-test-123';

    beforeEach(() => {
        doc = createCorngrDoc(userId, 'Test Document');
    });

    describe('Document Creation', () => {
        it('should create a Y.Doc with proper meta structure', () => {
            const meta = doc.getMap('meta');

            expect(meta.get('title')).toBe('Test Document');
            expect(meta.get('owner')).toBe(userId);
            expect(meta.get('id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            expect(meta.get('created')).toBeTruthy();
            expect(meta.get('modified')).toBeTruthy();
        });

        it('should initialize empty content array', () => {
            const content = doc.getArray('content');
            expect(content.length).toBe(0);
        });

        it('should create default owner permission', () => {
            const permissions = doc.getArray('permissions');
            expect(permissions.length).toBe(1);

            const ownerPerm = permissions.get(0) as Y.Map<any>;
            expect(ownerPerm.get('subject')).toBe(userId);
            expect(ownerPerm.get('action')).toBe('admin');
            expect(ownerPerm.get('resource')).toBe('*');
        });
    });

    describe('Block Creation and CRUD', () => {
        it('should create a paragraph block', () => {
            const blockId = createBlock(doc, 'paragraph', {
                text: 'Hello World'
            });

            const content = doc.getArray('content');
            expect(content.length).toBe(1);

            const block = content.get(0) as Y.Map<any>;
            expect(block.get('id')).toBe(blockId);
            expect(block.get('type')).toBe('paragraph');

            const data = block.get('data') as Y.Map<any>;
            expect(data.get('text')).toBe('Hello World');
        });

        it('should create variable block and read value (Sprint 1 Success Criterion)', () => {
            const blockId = createVariableBlock(doc, 'revenue', 1000, 'currency');

            const content = doc.getArray('content');
            expect(content.length).toBe(1);

            const block = content.get(0) as Y.Map<any>;
            const data = block.get('data') as Y.Map<any>;
            const value = data.get('value');

            expect(value.name).toBe('revenue');
            expect(value.value).toBe(1000);
            expect(value.format).toBe('currency');
        });

        it('should retrieve block by ID', () => {
            const blockId = createVariableBlock(doc, 'test_var', 500);
            const retrievedBlock = getBlock(doc, blockId);

            expect(retrievedBlock).toBeTruthy();
            expect(retrievedBlock?.get('id')).toBe(blockId);
        });

        it('should update block value', () => {
            const blockId = createVariableBlock(doc, 'revenue', 1000);

            updateBlockValue(doc, blockId, { name: 'revenue', value: 2000, format: 'currency' });

            const block = getBlock(doc, blockId);
            const data = block?.get('data') as Y.Map<any>;
            const value = data.get('value');

            expect(value.value).toBe(2000);
        });

        it('should convert block to JSON', () => {
            const blockId = createBlock(doc, 'heading1', {
                text: 'Introduction',
                metadata: { slideIndex: 0 }
            });

            const block = getBlock(doc, blockId);
            const json = blockToJSON(block!);

            expect(json.id).toBe(blockId);
            expect(json.type).toBe('heading1');
            expect(json.data.text).toBe('Introduction');
            expect(json.data.metadata.slideIndex).toBe(0);
        });

        it('should get all blocks as JSON array', () => {
            createBlock(doc, 'paragraph', { text: 'First' });
            createBlock(doc, 'paragraph', { text: 'Second' });
            createVariableBlock(doc, 'test', 100);

            const blocks = getAllBlocks(doc);
            expect(blocks.length).toBe(3);
            expect(blocks[0].data.text).toBe('First');
            expect(blocks[1].data.text).toBe('Second');
            expect(blocks[2].type).toBe('variable');
        });
    });

    describe('Permissions', () => {
        it('should add permission rules', () => {
            addPermission(doc, 'user-456', 'read', 'block-specific-id');

            const permissions = doc.getArray('permissions');
            expect(permissions.length).toBe(2); // Owner + new permission

            const newPerm = permissions.get(1) as Y.Map<any>;
            expect(newPerm.get('subject')).toBe('user-456');
            expect(newPerm.get('action')).toBe('read');
            expect(newPerm.get('resource')).toBe('block-specific-id');
        });

        it('should add ABAC conditions to permissions', () => {
            addPermission(doc, 'engineering-team', 'write', '*', {
                department: 'engineering',
                clearanceLevel: 3
            });

            const permissions = doc.getArray('permissions');
            const abacPerm = permissions.get(1) as Y.Map<any>;
            const conditions = abacPerm.get('conditions');

            expect(conditions.department).toBe('engineering');
            expect(conditions.clearanceLevel).toBe(3);
        });
    });

    describe('Value Formatting', () => {
        it('should format currency values', () => {
            expect(formatValue(1000, 'currency')).toBe('$1,000.00');
            expect(formatValue(1234567.89, 'currency')).toBe('$1,234,567.89');
        });

        it('should format percentage values', () => {
            expect(formatValue(0.25, 'percentage')).toBe('25.00%');
            expect(formatValue(1.5, 'percentage')).toBe('150.00%');
        });

        it('should format number values', () => {
            expect(formatValue(1000, 'number')).toBe('1,000');
            expect(formatValue(1234567, 'number')).toBe('1,234,567');
        });

        it('should format text values', () => {
            expect(formatValue('Hello', 'text')).toBe('Hello');
            expect(formatValue(123, 'text')).toBe('123');
        });
    });

    describe('Metadata Handling', () => {
        it('should store slide index metadata', () => {
            const blockId = createBlock(doc, 'paragraph', {
                text: 'Slide content',
                metadata: { slideIndex: 2 }
            });

            const block = getBlock(doc, blockId);
            const data = block?.get('data') as Y.Map<any>;
            const metadata = data.get('metadata') as Y.Map<any>;

            expect(metadata.get('slideIndex')).toBe(2);
        });

        it('should store layout metadata', () => {
            const blockId = createVariableBlock(doc, 'title', 'Revenue Report');
            const block = getBlock(doc, blockId);
            const data = block?.get('data') as Y.Map<any>;
            const metadata = data.get('metadata') as Y.Map<any>;

            expect(metadata.get('layout')).toBe('inline');
        });

        it('should store ACL metadata', () => {
            const blockId = createBlock(doc, 'paragraph', {
                text: 'Sensitive data',
                metadata: { acl: ['admin-role', 'manager-role'] }
            });

            const json = blockToJSON(getBlock(doc, blockId)!);
            expect(json.data.metadata.acl).toEqual(['admin-role', 'manager-role']);
        });
    });

    describe('Document Timestamps', () => {
        it('should update document modified time when adding blocks', async () => {
            const meta = doc.getMap('meta');
            const initialModified = meta.get('modified');

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            createBlock(doc, 'paragraph', { text: 'New block' });

            const newModified = meta.get('modified');
            expect(new Date(newModified as string).getTime()).toBeGreaterThan(
                new Date(initialModified as string).getTime()
            );
        });

        it('should update document modified time when updating blocks', async () => {
            const blockId = createVariableBlock(doc, 'test', 100);

            await new Promise(resolve => setTimeout(resolve, 10));

            updateBlockValue(doc, blockId, { name: 'test', value: 200 });

            const block = getBlock(doc, blockId);
            expect(block?.get('modified')).toBeTruthy();
        });
    });
});
