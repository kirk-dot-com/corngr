export interface UserAttributes {
    role: 'editor' | 'auditor' | 'viewer' | 'admin';
}

export interface User {
    id: string;
    name: string;
    role: 'editor' | 'auditor' | 'viewer' | 'admin';
    color: string;
    attributes: UserAttributes; // Ensure nesting is correct for ABAC
}

export interface Action {
    type: string;
    payload?: any;
}
