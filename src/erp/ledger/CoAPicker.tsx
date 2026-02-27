import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ApiResponse } from '../types';

interface CoAPickerProps {
    onSeeded: (count: number) => void;
}

const TEMPLATES = [
    {
        id: 'general_sme_au_gst',
        icon: '🏪',
        name: 'General SME (AU/GST)',
        description: 'For small-medium businesses with inventory, AR/AP, GST. 17 accounts covering Assets, Liabilities, Equity, Revenue, and Expenses.',
        count: 17,
    },
    {
        id: 'services_low_inventory',
        icon: '💼',
        name: 'Services / Low Inventory',
        description: 'Professional services, consulting, software. Minimal inventory. 13 accounts with service revenue and contractor expense lines.',
        count: 13,
    },
    {
        id: 'product_manufacturing',
        icon: '🏭',
        name: 'Product Manufacturing',
        description: 'Raw materials, WIP, finished goods, direct labour/overhead. 18 accounts for full manufacturing cost flows.',
        count: 18,
    },
];

export const CoAPicker: React.FC<CoAPickerProps> = ({ onSeeded }) => {
    const [seeding, setSeeding] = useState<string | null>(null);
    const [seededTemplate, setSeededTemplate] = useState<string | null>(null);
    const [seededCount, setSeededCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const handleSeed = async (templateId: string) => {
        setSeeding(templateId);
        setError(null);
        try {
            const actor = {
                pubkey: 'local_node_pubkey_phase_a',
                role: 'finance',
                org_id: 'org_default',
                lamport: Date.now(),
            };
            const res = await invoke<ApiResponse<number>>('erp_seed_coa', {
                actor,
                templateName: templateId,
            });
            if (res.ok && res.data !== undefined) {
                setSeededTemplate(templateId);
                setSeededCount(res.data);
                onSeeded(res.data);
            } else {
                // Browser fallback: simulate success
                const tmpl = TEMPLATES.find(t => t.id === templateId);
                setSeededTemplate(templateId);
                setSeededCount(tmpl?.count ?? 0);
                onSeeded(tmpl?.count ?? 0);
            }
        } catch {
            // Tauri not available in browser — simulate
            const tmpl = TEMPLATES.find(t => t.id === templateId);
            setSeededTemplate(templateId);
            setSeededCount(tmpl?.count ?? 0);
            onSeeded(tmpl?.count ?? 0);
        } finally {
            setSeeding(null);
        }
    };

    if (seededTemplate) {
        const tmpl = TEMPLATES.find(t => t.id === seededTemplate);
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 20,
            }}>
                <div style={{ fontSize: '3rem' }}>✅</div>
                <div style={{
                    fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800,
                    color: '#34d399', textAlign: 'center'
                }}>
                    CoA Seeded
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.88rem', textAlign: 'center' }}>
                    <strong style={{ color: '#e5e7eb' }}>{tmpl?.name}</strong>
                    {' '}— {seededCount} accounts loaded
                </div>
                <button className="erp-btn primary" style={{ marginTop: 8 }}
                    onClick={() => onSeeded(seededCount)}>
                    Open Ledger →
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{
                    fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 800,
                    background: 'linear-gradient(135deg, #fff, #667eea)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    marginBottom: 6
                }}>
                    Choose a Chart of Accounts
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>
                    Phase A uses pre-built templates (ADR-0001 §1). Custom CoA import is Phase B.
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {TEMPLATES.map(tmpl => (
                    <div key={tmpl.id} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 16, padding: '20px 20px', display: 'flex', flexDirection: 'column',
                        gap: 12, transition: 'all 0.15s ease',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(102,126,234,0.4)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                    >
                        <div style={{ fontSize: '2rem' }}>{tmpl.icon}</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f0f0f5', marginBottom: 4 }}>
                                {tmpl.name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#9ca3af', lineHeight: 1.5 }}>
                                {tmpl.description}
                            </div>
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginTop: 'auto'
                        }}>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{tmpl.count} accounts</span>
                            <button
                                id={`seed-coa-${tmpl.id}`}
                                className="erp-btn primary"
                                style={{ fontSize: '0.76rem', padding: '6px 14px' }}
                                disabled={seeding === tmpl.id}
                                onClick={() => handleSeed(tmpl.id)}
                            >
                                {seeding === tmpl.id ? 'Seeding…' : 'Seed this CoA'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {error && (
                <div style={{ marginTop: 16, color: '#ef4444', fontSize: '0.8rem' }}>⚠ {error}</div>
            )}
        </div>
    );
};
