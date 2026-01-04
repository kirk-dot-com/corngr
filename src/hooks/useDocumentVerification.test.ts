import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDocumentVerification } from './useDocumentVerification';
import { MetadataStore } from '../metadata/MetadataStore';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));

vi.mock('../utils/crypto', () => ({
    sha256: vi.fn().mockResolvedValue('mock-hash')
}));

import { invoke } from '@tauri-apps/api/core';

describe('useDocumentVerification', () => {
    let metadataStore: MetadataStore;
    let editorView: any;

    beforeEach(() => {
        metadataStore = new MetadataStore();

        // Mock EditorView structure needed by hook
        // We simulate a doc with 2 blocks
        editorView = {
            state: {
                doc: {
                    descendants: (cb: any) => {
                        // Node 1: Signed
                        cb({
                            isBlock: true,
                            attrs: { blockId: 'block-signed' },
                            textContent: 'secure content'
                        });
                        // Node 2: Unsigned
                        cb({
                            isBlock: true,
                            attrs: { blockId: 'block-unsigned' },
                            textContent: 'draft content'
                        });
                        return false;
                    }
                }
            }
        };

        vi.clearAllMocks();
    });

    it('verifies signed blocks and updates metadata store (VALID)', async () => {
        // Setup signed block metadata
        metadataStore.set('block-signed', {
            provenance: { signature: 'valid-sig' }
        } as any);

        // Mock backend verification returning TRUE
        (invoke as any).mockResolvedValue(true);

        renderHook(() => useDocumentVerification(editorView, metadataStore));

        // It should eventually mark as verified
        await waitFor(() => {
            expect(metadataStore.getVerificationStatus('block-signed')).toBe('verified');
        });

        // Unsigned block should be marked unsigned
        expect(metadataStore.getVerificationStatus('block-unsigned')).toBe('unsigned');
    });

    it('detects tampered blocks (INVALID)', async () => {
        // Setup signed block metadata
        metadataStore.set('block-signed', {
            provenance: { signature: 'tampered-sig' }
        } as any);

        // Mock backend verification returning FALSE
        (invoke as any).mockResolvedValue(false);

        renderHook(() => useDocumentVerification(editorView, metadataStore));

        await waitFor(() => {
            expect(metadataStore.getVerificationStatus('block-signed')).toBe('tampered');
        });
    });
});
