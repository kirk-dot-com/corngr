import { Block } from '../yjs/schema';

export interface TauriSecureNetwork {
    requestCapabilityToken(refId: string): void;
    resolveExternalReference(refId: string): Promise<Block | null>;
    getReferenceStore(): ReferenceStore;
}

export interface ReferenceStore {
    getReference(id: string): { status: 'pending' | 'active' | 'denied' | 'error' } | undefined;
}

// Mock implementation for build
export class MockTauriSecureNetwork implements TauriSecureNetwork {
    requestCapabilityToken(refId: string): void {
        console.log('Mock: Requesting token for', refId);
    }

    async resolveExternalReference(refId: string): Promise<Block | null> {
        console.log('Mock: Resolving reference', refId);
        return null; // Return null to simulate loading failure or empty
    }

    getReferenceStore(): ReferenceStore {
        return {
            getReference: () => undefined
        };
    }
}
