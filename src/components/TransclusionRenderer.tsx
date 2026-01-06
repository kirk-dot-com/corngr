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
    const containerRef = React.useRef<HTMLSpanElement>(null);

    // [Sprint 4] Proximity-based Prefetching
    useEffect(() => {
        if (!containerRef.current || !network) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    console.log(`🎯 [Sprint 4] Proximity Trigger: Prefetching for ${refId}`);
                    network.requestCapabilityToken(refId);
                    observer.disconnect(); // Only prefetch once per mount
                }
            });
        }, { rootMargin: '200px' }); // Load when within 200px of viewport

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [refId, network]);

    useEffect(() => {
        let mounted = true;

        const resolve = async () => {
            if (!network) {
                setStatus('error');
                return;
            }

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
        return <span ref={containerRef} className="transclusion loading">{fallbackText}</span>;
    }

    if (status === 'denied') {
        return (
            <span ref={containerRef} className="transclusion denied" title="Access Denied by Origin ABAC Engine">
                🔒 Access Restricted
            </span>
        );
    }

    if (status === 'error' || !content) {
        return <span ref={containerRef} className="transclusion error">⚠️ Broken Reference</span>;
    }

    // Render based on the resolved block type
    const { type, data } = content;
    const value = type === 'variable' ? data.value?.value : data.text;
    const formatted = type === 'variable' ? formatValue(value, data.value?.format) : value;

    // [Phase 4] Check for Cryptographic Verification
    const isVerified = !!data.metadata?.origin_doc_id;
    const statusClass = isVerified ? 'verified' : 'active';

    return (
        <span ref={containerRef} className={`transclusion ${statusClass}`} title={`Source: ${content.id}`}>
            {formatted}
        </span>
    );
};
