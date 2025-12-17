import React from 'react';
import { User } from './types';
import { canViewBlock } from './permissions';
import { Block } from '../yjs/schema';

interface PermissionGateProps {
    user: User | null; // Null means anonymous/public
    block: Block;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Access Control Component
 * Renders children only if the user has permission to view the block.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
    user,
    block,
    children,
    fallback
}) => {
    // If no user is provided, create a default anonymous guest
    const efficientUser = user || { id: 'guest', attributes: { role: 'viewer' } } as User;

    const hasAccess = canViewBlock(efficientUser, block.data.metadata);

    if (!hasAccess) {
        return fallback || (
            <div style={{
                padding: '1rem',
                background: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb',
                borderRadius: '8px',
                textAlign: 'center',
                fontStyle: 'italic',
                margin: '1rem 0'
            }}>
                🔒 Restricted Content
            </div>
        );
    }

    return <>{children}</>;
};
