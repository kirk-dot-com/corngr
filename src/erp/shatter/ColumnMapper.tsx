import React, { useEffect, useState } from 'react';

export interface MappingConfig {
    tx_type?: string;
    tx_date?: string;
    description?: string;
    currency?: string;
    party_id?: string;
    ref_number?: string;
    line_description?: string;
    qty?: string;
    unit_price?: string;
    tax_rate?: string;
}

// Deterministic rule table: common header patterns → ERP field
const SUGGESTIONS: Record<string, keyof MappingConfig> = {
    type: 'tx_type', txtype: 'tx_type', 'transaction type': 'tx_type', kind: 'tx_type',
    date: 'tx_date', 'transaction date': 'tx_date', 'invoice date': 'tx_date', txdate: 'tx_date',
    description: 'description', desc: 'description', memo: 'description', narration: 'description',
    currency: 'currency', ccy: 'currency',
    customer: 'party_id', vendor: 'party_id', supplier: 'party_id', 'party id': 'party_id', party: 'party_id',
    reference: 'ref_number', ref: 'ref_number', 'invoice no': 'ref_number', 'invoice number': 'ref_number',
    'line description': 'line_description', item: 'line_description', product: 'line_description',
    qty: 'qty', quantity: 'qty', units: 'qty',
    price: 'unit_price', amount: 'unit_price', 'unit price': 'unit_price', rate: 'unit_price',
    tax: 'tax_rate', 'tax rate': 'tax_rate', gst: 'tax_rate', vat: 'tax_rate',
};

const ERP_FIELDS: { key: keyof MappingConfig; label: string }[] = [
    { key: 'tx_type', label: 'tx_type (invoice_out, invoice_in, …)' },
    { key: 'tx_date', label: 'tx_date (YYYY-MM-DD)' },
    { key: 'description', label: 'description' },
    { key: 'currency', label: 'currency (AUD, USD, …)' },
    { key: 'party_id', label: 'party_id (customer/vendor)' },
    { key: 'ref_number', label: 'ref_number (invoice no.)' },
    { key: 'line_description', label: 'line description' },
    { key: 'qty', label: 'qty (quantity)' },
    { key: 'unit_price', label: 'unit_price (amount)' },
    { key: 'tax_rate', label: 'tax_rate (0.1 = 10%)' },
];

function suggest(header: string): keyof MappingConfig | undefined {
    const key = header.toLowerCase().trim();
    return SUGGESTIONS[key];
}

interface ColumnMapperProps {
    headers: string[];
    onChange: (mapping: MappingConfig) => void;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({ headers, onChange }) => {
    const [mapping, setMapping] = useState<MappingConfig>(() => {
        const m: MappingConfig = {};
        for (const h of headers) {
            const field = suggest(h);
            if (field && !(field in m)) (m as any)[field] = h;
        }
        return m;
    });

    useEffect(() => { onChange(mapping); }, [mapping, onChange]);

    const setField = (field: keyof MappingConfig, col: string) => {
        setMapping(prev => ({ ...prev, [field]: col || undefined }));
    };

    return (
        <div>
            <div style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.9px',
                textTransform: 'uppercase', color: '#6b7280', marginBottom: 12
            }}>
                Column → ERP Field Mapping
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                {ERP_FIELDS.map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: '0.66rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                            {key}
                        </label>
                        <select
                            value={(mapping as any)[key] ?? ''}
                            onChange={e => setField(key, e.target.value)}
                            style={{
                                background: '#111827', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 8, color: '#e5e7eb', fontSize: '0.76rem', padding: '5px 10px',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="">— skip —</option>
                            {headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                        <div style={{ fontSize: '0.62rem', color: '#4b5563' }}>{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
