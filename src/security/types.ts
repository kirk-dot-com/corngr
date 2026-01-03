export interface UserAttributes {
    role: 'editor' | 'auditor' | 'viewer';
}

export interface User {
    id: string;
    name: string;
    role: 'editor' | 'auditor' | 'viewer';
    color: string;
    attributes: UserAttributes; // Ensure nesting is correct for ABAC
}

export interface Action {
    type: string;
    payload?: any;
}
