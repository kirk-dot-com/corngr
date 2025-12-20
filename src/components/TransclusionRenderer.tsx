import React, { useState, useEffect } from 'react';
import { formatValue } from '../yjs/schema';
import { TauriSecureNetwork } from '../security/TauriSecureNetwork';
import './TransclusionRenderer.css';

interface TransclusionRendererProps {
    network: TauriSecureNetwork;
    refId: string;
    fallbackText?: string;
}

/**
 * TransclusionRenderer [Sprint 3]
 * 
 * Dynamically resolves an external reference across .crng documents.
 * Enforces "No Caching" by fetching fresh data on mount (or refId change).
 */
export const TransclusionRenderer: React.FC<TransclusionRendererProps> = ({
    network,
    refId,
    fallbackText = 'Loading secure reference...'
}) => {
    const [content, setContent] = useState<any>(null);
    const [status, setStatus] = useState<'loading' | 'success' | 'denied' | 'error'>('loading');

    useEffect(() => {
        let mounted = true;

        const resolve = async () => {
            setStatus('loading');
            try {
                const block = await network.resolveExternalReference(refId);

                if (mounted) {
                    if (block) {
                        setContent(block);
                        setStatus('success');
                    } else {
                        // Check why it failed - likely permission denied
                        const ref = network.getReferenceStore().getReference(refId);
                        setStatus(ref?.status === 'denied' ? 'denied' : 'error');
                    }
                }
            } catch (err) {
                console.error('Failed to resolve transclusion:', err);
                if (mounted) setStatus('error');
            }
        };

        resolve();

        return () => {
            mounted = false;
        };
    }, [network, refId]);

    if (status === 'loading') {
        return <span className="transclusion loading">{fallbackText}</span>;
    }

    if (status === 'denied') {
        return (
            <span className="transclusion denied" title="Access Denied by Origin ABAC Engine">
                🔒 Access Restricted
            </span>
        );
    }

    if (status === 'error' || !content) {
        return <span className="transclusion error">⚠️ Broken Reference</span>;
    }

    // Render based on the resolved block type
    const { type, data } = content;
    const value = type === 'variable' ? data.value?.value : data.text;
    const formatted = type === 'variable' ? formatValue(value, data.value?.format) : value;

    return (
        <span className="transclusion active" title={`Source: ${content.id}`}>
            {formatted}
        </span>
    );
};
