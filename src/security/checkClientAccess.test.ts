import { describe, it, expect } from 'vitest';
import { checkClientAccess, checkClientEditAccess } from './checkClientAccess';
import { User } from './types';
import { BlockMetadata } from '../yjs/schema';

describe('checkClientAccess', () => {
    const adminUser: User = {
        id: 'admin-123',
        role: 'admin',
        attributes: {
            role: 'admin',
            clearanceLevel: 3
        }
    };

    const editorUser: User = {
        id: 'editor-456',
        role: 'editor',
        attributes: {
            role: 'editor',
            clearanceLevel: 2
        }
    };

    const viewerUser: User = {
        id: 'viewer-789',
        role: 'viewer',
        attributes: {
            role: 'viewer',
            clearanceLevel: 1
        }
    };

    describe('Classification-based Access', () => {
        it('should allow access to public content for all users', () => {
            const metadata: BlockMetadata = { classification: 'public' };

            expect(checkClientAccess(viewerUser, metadata)).toBe(true);
            expect(checkClientAccess(editorUser, metadata)).toBe(true);
            expect(checkClientAccess(adminUser, metadata)).toBe(true);
        });

        it('should allow internal content for clearance >= 1', () => {
            const metadata: BlockMetadata = { classification: 'internal' };

            expect(checkClientAccess(viewerUser, metadata)).toBe(true); // clearance 1
            expect(checkClientAccess(editorUser, metadata)).toBe(true); // clearance 2
            expect(checkClientAccess(adminUser, metadata)).toBe(true); // clearance 3
        });

        it('should allow confidential content for clearance >= 2', () => {
            const metadata: BlockMetadata = { classification: 'confidential' };

            expect(checkClientAccess(viewerUser, metadata)).toBe(false); // clearance 1
            expect(checkClientAccess(editorUser, metadata)).toBe(true); // clearance 2
            expect(checkClientAccess(adminUser, metadata)).toBe(true); // clearance 3
        });

        it('should allow restricted content only for clearance >= 3', () => {
            const metadata: BlockMetadata = { classification: 'restricted' };

            expect(checkClientAccess(viewerUser, metadata)).toBe(false); // clearance 1
            expect(checkClientAccess(editorUser, metadata)).toBe(false); // clearance 2
            expect(checkClientAccess(adminUser, metadata)).toBe(true); // clearance 3
        });

        it('should default to public if no classification specified', () => {
            const metadata: BlockMetadata = {};

            expect(checkClientAccess(viewerUser, metadata)).toBe(true);
        });
    });

    describe('ACL-based Access', () => {
        it('should allow access if user ID is in ACL', () => {
            const metadata: BlockMetadata = {
                classification: 'internal',
                acl: ['editor-456', 'admin-123']
            };

            expect(checkClientAccess(editorUser, metadata)).toBe(true);
            expect(checkClientAccess(adminUser, metadata)).toBe(true);
            expect(checkClientAccess(viewerUser, metadata)).toBe(false);
        });

        it('should allow access if user role is in ACL', () => {
            const metadata: BlockMetadata = {
                classification: 'confidential',
                acl: ['editor', 'admin']
            };

            expect(checkClientAccess(editorUser, metadata)).toBe(true);
            expect(checkClientAccess(adminUser, metadata)).toBe(true);
            expect(checkClientAccess(viewerUser, metadata)).toBe(false);
        });

        it('should deny access if ACL specified but user not in it', () => {
            const metadata: BlockMetadata = {
                classification: 'public',
                acl: ['admin-123']
            };

            expect(checkClientAccess(adminUser, metadata)).toBe(true);
            expect(checkClientAccess(editorUser, metadata)).toBe(false);
            expect(checkClientAccess(viewerUser, metadata)).toBe(false);
        });

        it('should allow access if ACL is empty (no restrictions)', () => {
            const metadata: BlockMetadata = {
                classification: 'internal',
                acl: []
            };

            expect(checkClientAccess(viewerUser, metadata)).toBe(true);
        });
    });

    describe('Combined Classification + ACL', () => {
        it('should require both clearance AND ACL membership', () => {
            const metadata: BlockMetadata = {
                classification: 'confidential', // Requires clearance >= 2
                acl: ['editor'] // Requires editor role
            };

            // Viewer: has role but not clearance
            expect(checkClientAccess(viewerUser, metadata)).toBe(false);

            // Editor: has both clearance and role
            expect(checkClientAccess(editorUser, metadata)).toBe(true);

            // Admin: has clearance but not in ACL
            expect(checkClientAccess(adminUser, metadata)).toBe(false);
        });
    });

    describe('Locked Content', () => {
        it('should allow viewing locked content if clearance permits', () => {
            const metadata: BlockMetadata = {
                classification: 'internal',
                locked: true
            };

            // For read access, locked doesn't block
            expect(checkClientAccess(viewerUser, metadata)).toBe(true);
            expect(checkClientAccess(editorUser, metadata)).toBe(true);
            expect(checkClientAccess(adminUser, metadata)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should allow access if no user provided', () => {
            const metadata: BlockMetadata = { classification: 'confidential' };

            expect(checkClientAccess(null, metadata)).toBe(true);
        });

        it('should allow access if no metadata provided', () => {
            expect(checkClientAccess(viewerUser, null)).toBe(true);
            expect(checkClientAccess(viewerUser, undefined)).toBe(true);
        });

        it('should allow access if both user and metadata are null', () => {
            expect(checkClientAccess(null, null)).toBe(true);
        });

        it('should handle users with no clearance level (default 0)', () => {
            const userNoClearance: User = {
                id: 'user-000',
                role: 'viewer',
                attributes: {
                    role: 'viewer'
                    // no clearanceLevel
                }
            };

            const publicMeta: BlockMetadata = { classification: 'public' };
            const internalMeta: BlockMetadata = { classification: 'internal' };

            expect(checkClientAccess(userNoClearance, publicMeta)).toBe(true);
            expect(checkClientAccess(userNoClearance, internalMeta)).toBe(false);
        });
    });
});

describe('checkClientEditAccess', () => {
    const adminUser: User = {
        id: 'admin-123',
        role: 'admin',
        attributes: {
            role: 'admin',
            clearanceLevel: 3
        }
    };

    const editorUser: User = {
        id: 'editor-456',
        role: 'editor',
        attributes: {
            role: 'editor',
            clearanceLevel: 2
        }
    };

    describe('Locked Content Editing', () => {
        it('should deny edit access to non-admin users for locked content', () => {
            const metadata: BlockMetadata = {
                classification: 'internal',
                locked: true
            };

            expect(checkClientEditAccess(editorUser, metadata)).toBe(false);
        });

        it('should allow edit access to admin users for locked content', () => {
            const metadata: BlockMetadata = {
                classification: 'restricted',
                locked: true
            };

            expect(checkClientEditAccess(adminUser, metadata)).toBe(true);
        });

        it('should allow edit access to non-locked content based on read permissions', () => {
            const metadata: BlockMetadata = {
                classification: 'confidential',
                locked: false
            };

            expect(checkClientEditAccess(editorUser, metadata)).toBe(true);
        });
    });

    describe('Edit Access Inheritance', () => {
        it('should deny edit if read access is denied', () => {
            const metadata: BlockMetadata = {
                classification: 'restricted' // Editor has clearance 2, needs 3
            };

            expect(checkClientEditAccess(editorUser, metadata)).toBe(false);
        });
    });
});
