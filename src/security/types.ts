export interface UserAttributes {
    role: 'editor' | 'auditor' | 'viewer' | 'admin';
    email?: string;
    clearanceLevel?: number;
    department?: string;
}

export interface ACL {
    allowedRoles: string[];
    allowedUsers: string[];
    requiredDepartment?: string;
}

export interface User {
    id: string;
    name: string;
    role: 'editor' | 'auditor' | 'viewer' | 'admin';
    color: string;
    attributes: UserAttributes; // Ensure nesting is correct for ABAC
}

export interface AuditEvent {
    timestamp: string;
    user_id: string;
    action: string;
    resource_id: string;
    details: string;
    severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
}

export interface Action {
    type: string;
    payload?: any;
}
