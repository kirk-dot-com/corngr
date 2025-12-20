import { User } from './types';
import { BlockMetadata } from '../yjs/schema';

/**
 * Client-side access control validation
 * 
 * Purpose: Fast client-side checks for UI rendering (NOT authoritative).
 * The Rust backend remains the authoritative source for all permission decisions.
 * 
 * This function mirrors the logic in the Rust ABAC engine to provide
 * immediate visual feedback (classification badges, redaction) without
 * round-tripping to the backend for every block render.
 * 
 * Phase 2: Used by BlockRenderer and FilterPlugin
 */
export function checkClientAccess(
    user: User | null,
    metadata: BlockMetadata | undefined | null
): boolean {
    if (!user || !metadata) {
        return true; // No restrictions if no user or no metadata
    }

    const { classification, acl, locked } = metadata;
    const clearance = user.attributes.clearanceLevel || 0;

    // 1. Classification Check (Clearance Level)
    const levelMap: Record<string, number> = {
        public: 0,
        internal: 1,
        confidential: 2,
        restricted: 3
    };

    const requiredLevel = levelMap[classification || 'public'];
    if (clearance < requiredLevel) {
        return false; // User clearance too low
    }

    // 2. ACL Check (Access Control List)
    // If ACL is specified, user must be in the list (by ID or role)
    if (acl && acl.length > 0) {
        const hasAccess =
            acl.includes(user.id) ||
            acl.includes(user.attributes.role);

        if (!hasAccess) {
            return false; // User not in ACL
        }
    }

    // 3. Cross-Origin Check [Sprint 3]
    // If block is from an external document, apply origin-based policies
    if (metadata.originDocId && metadata.originDocId !== 'local') {
        const isExternal = true;

        // Strict Policy: Non-admins cannot read Restricted external content
        // unless they have a high clearance level.
        if (isExternal && classification === 'restricted' && user.attributes.role !== 'admin') {
            if (clearance < 3) return false;
        }

        // Potential for future origin-specific whitelisting here
        // if (metadata.originUrl && !user.attributes.allowedOrigins?.includes(metadata.originUrl)) {
        //     return false;
        // }
    }

    return true; // All checks passed
}

/**
 * Check if user can edit a block
 * Stricter than checkClientAccess (includes locked check)
 */
export function checkClientEditAccess(
    user: User | null,
    metadata: BlockMetadata | undefined | null
): boolean {
    if (!checkClientAccess(user, metadata)) {
        return false; // Can't read = can't edit
    }

    if (!user || !metadata) {
        return true;
    }

    // Locked blocks require admin role
    if (metadata.locked && user.attributes.role !== 'admin') {
        return false;
    }

    return true;
}
