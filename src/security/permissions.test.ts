import { describe, it, expect } from 'vitest';
import { matchesACL, canViewBlock } from './permissions';
import { User } from './types';

describe('ABAC Security Engine', () => {

    const adminUser: User = {
        id: 'admin-1',
        role: 'admin',
        attributes: { role: 'admin', clearanceLevel: 5, department: 'IT' }
    };

    const viewerUser: User = {
        id: 'viewer-1',
        role: 'viewer',
        attributes: { role: 'viewer', clearanceLevel: 1, department: 'Sales' }
    };

    describe('Role-Based Access', () => {
        it('should allow access if role matches', () => {
            const acl = { requiredRoles: ['admin'] };
            // Admin should pass
            expect(matchesACL(adminUser, acl as any)).toBe(true);
            // Viewer should fail
            expect(matchesACL(viewerUser, acl as any)).toBe(false);
        });

        it('should allow public access if no ACL', () => {
            expect(matchesACL(viewerUser, null)).toBe(true);
            expect(matchesACL(viewerUser, { allowedUsers: [] })).toBe(true);
        });
    });

    describe('Clearance-Based Access', () => {
        it('should enforce clearance levels', () => {
            const acl = { requiredClearance: 3 };

            // Admin (Level 5) should pass
            expect(matchesACL(adminUser, acl as any)).toBe(true);

            // Viewer (Level 1) should fail
            expect(matchesACL(viewerUser, acl as any)).toBe(false);
        });
    });

    describe('Block Metadata Helper', () => {
        it('should handle simple string array ACLs (MVP style)', () => {
            // "acl": ["admin"]
            const metadata = { acl: ['admin'] };

            expect(canViewBlock(adminUser, metadata)).toBe(true);
            expect(canViewBlock(viewerUser, metadata)).toBe(false);
        });

        it('should allow simple array if user has one of the roles', () => {
            const metadata = { acl: ['admin', 'viewer'] };
            expect(canViewBlock(viewerUser, metadata)).toBe(true);
        });
    });
});
