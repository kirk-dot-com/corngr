export type Role = 'admin' | 'viewer' | 'editor';

export interface UserAttributes {
    role: Role;
    department?: string;
    clearanceLevel?: number;
    [key: string]: any;
}

export interface User {
    id: string;
    attributes: UserAttributes;
}

export interface PermissionRule {
    resource: string; // The type of resource or specific ID
    action: 'read' | 'write' | 'admin';
    conditions?: Record<string, any>; // Attributes that must match
}

export interface ACL {
    requiredRoles?: Role[];
    requiredClearance?: number;
    requiredDepartment?: string;
}
