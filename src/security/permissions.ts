import { User, ACL } from './types';

/**
 * Checks if a user satisfies the Access Control List (ACL) requirements
 */
export function matchesACL(user: User, acl: ACL | undefined | null): boolean {
    // No ACL means public access
    if (!acl || Object.keys(acl).length === 0) {
        return true;
    }

    const { attributes } = user;

    // 1. Check Role
    if (acl.requiredRoles && acl.requiredRoles.length > 0) {
        if (!acl.requiredRoles.includes(attributes.role)) {
            return false;
        }
    }

    // 2. Check Clearance Level
    if (acl.requiredClearance) {
        const userLevel = attributes.clearanceLevel || 0;
        if (userLevel < acl.requiredClearance) {
            return false;
        }
    }

    // 3. Check Department
    if (acl.requiredDepartment) {
        if (attributes.department !== acl.requiredDepartment) {
            return false;
        }
    }

    return true;
}

/**
 * Checks if a block is visible to a user
 * Note: Block structure passed here matches the standard Yjs Block JSON
 */
export function canViewBlock(user: User, blockMetadata: any): boolean {
    // The schema stores 'acl' as array of strings (rule IDs) in Yjs, 
    // but for this phase we simulate 'acl' effectively being the ACL object stored in metadata
    // or referenced by it. 

    // In our simplified Phase 0 plan, we often just check "acl: ['admin']".
    // Let's support both the string-array style (simple roles) AND the object style (full ABAC).

    const rawAcl = blockMetadata?.acl;

    if (!rawAcl) return true; // Public by default

    // Case A: Simple array of required roles e.g. ['admin', 'manager']
    if (Array.isArray(rawAcl)) {
        if (rawAcl.length === 0) return true;
        // If string array, treat as list of allowed roles
        return rawAcl.includes(user.attributes.role);
    }

    // Case B: Full ACL Object (ABAC)
    return matchesACL(user, rawAcl);
}
