import React, { useState, useCallback, useMemo } from 'react';
import type { Party, CreatePartyRequest, PartyKind } from '../types';

interface PartyManagerProps {
    parties: Party[];
    onCreateParty: (req: CreatePartyRequest) => Promise<unknown>;
    onClose: () => void;
}

const KIND_LABELS: Record<PartyKind, string> = {
    customer: 'Customer',
    supplier: 'Supplier',
    employee: 'Employee',
    other: 'Other',
};

const KIND_CLASS: Record<PartyKind, string> = {
    customer: 'kind-customer',
    supplier: 'kind-supplier',
    employee: 'kind-employee',
    other: 'kind-other',
};

export const PartyManager: React.FC<PartyManagerProps> = ({ parties, onCreateParty, onClose }) => {
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);

    // ── Create party form state ───────────────────────────
    const [name, setName] = useState('');
    const [kind, setKind] = useState<string>('customer');
    const [email, setEmail] = useState('');
    const [contact, setContact] = useState('');
    const [abn, setAbn] = useState('');
    const [busy, setBusy] = useState(false);
    const [formErr, setFormErr] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return parties;
        return parties.filter(
            p =>
                p.name.toLowerCase().includes(q) ||
                p.kind.includes(q) ||
                p.email?.toLowerCase().includes(q) ||
                p.abn?.includes(q)
        );
    }, [parties, search]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setFormErr('Name is required'); return; }
        setBusy(true);
        setFormErr(null);
        try {
            await onCreateParty({
                org_id: 'org_default',
                name: name.trim(),
                kind,
                email: email || undefined,
                contact: contact || undefined,
                abn: abn || undefined,
            });
            setSuccessMsg(`✓ ${name.trim()} created`);
            setName(''); setEmail(''); setContact(''); setAbn('');
            setTimeout(() => setSuccessMsg(null), 2500);
            setShowForm(false);
        } catch (err) {
            setFormErr(String(err));
        } finally {
            setBusy(false);
        }
    }, [name, kind, email, contact, abn, onCreateParty]);

    return (
        <>
            {/* Backdrop */}
            <div className="drill-panel-overlay" onClick={onClose} />

            {/* Panel */}
            <div className="drill-panel party-manager" role="dialog" aria-label="Party Manager">
                {/* Header */}
                <div className="drill-header">
                    <div>
                        <div className="drill-title">👥 Party Master</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--erp-text2)', marginTop: 2 }}>
                            {parties.length} {parties.length === 1 ? 'party' : 'parties'} on record
                        </div>
                    </div>
                    <button className="drill-close" onClick={onClose} id="party-manager-close">✕</button>
                </div>

                {/* Search + Add button */}
                <div className="party-toolbar">
                    <input
                        id="party-search-input"
                        type="text"
                        className="party-search"
                        placeholder="Search by name, kind, email, ABN…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button
                        className="action-btn add"
                        id="party-add-btn"
                        onClick={() => { setShowForm(s => !s); setFormErr(null); }}
                    >
                        {showForm ? '✕ Cancel' : '＋ New Party'}
                    </button>
                </div>

                {/* Inline create form */}
                {showForm && (
                    <form className="party-create-form drill-inline-form" onSubmit={handleSubmit}>
                        <div className="form-row">
                            <label>
                                Name *
                                <input
                                    id="party-name-input"
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Acme Corp"
                                    required
                                />
                            </label>
                            <label>
                                Kind
                                <select
                                    id="party-kind-select"
                                    value={kind}
                                    onChange={e => setKind(e.target.value)}
                                >
                                    <option value="customer">Customer</option>
                                    <option value="supplier">Supplier</option>
                                    <option value="employee">Employee</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                        </div>
                        <div className="form-row">
                            <label>
                                Email
                                <input
                                    id="party-email-input"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="accounts@acme.com"
                                />
                            </label>
                            <label>
                                Contact
                                <input
                                    id="party-contact-input"
                                    type="text"
                                    value={contact}
                                    onChange={e => setContact(e.target.value)}
                                    placeholder="Jane Smith"
                                />
                            </label>
                        </div>
                        <div className="form-row">
                            <label>
                                ABN
                                <input
                                    id="party-abn-input"
                                    type="text"
                                    value={abn}
                                    onChange={e => setAbn(e.target.value)}
                                    placeholder="12 345 678 901"
                                />
                            </label>
                        </div>
                        {formErr && <p className="form-error">{formErr}</p>}
                        <div className="form-actions">
                            <button type="submit" className="action-btn propose" disabled={busy} id="party-submit-btn">
                                {busy ? 'Saving…' : '✓ Create Party'}
                            </button>
                        </div>
                    </form>
                )}

                {successMsg && <div className="action-msg" style={{ margin: '0 20px 10px' }}>{successMsg}</div>}

                {/* Party list */}
                <div className="drill-body">
                    {filtered.length === 0 ? (
                        <div className="erp-empty-state">
                            <span className="empty-icon">👥</span>
                            <p>{search ? 'No parties match your search.' : 'No parties yet — add your first customer or supplier.'}</p>
                        </div>
                    ) : (
                        <div className="party-list">
                            {filtered.map(p => (
                                <div key={p.party_id} className="party-row" id={`party-row-${p.party_id}`}>
                                    <div className="party-row-main">
                                        <span className={`party-kind-badge ${KIND_CLASS[p.kind]}`}>
                                            {KIND_LABELS[p.kind]}
                                        </span>
                                        <span className="party-name">{p.name}</span>
                                    </div>
                                    <div className="party-row-meta">
                                        {p.email && <span>{p.email}</span>}
                                        {p.abn && <span className="party-abn">ABN {p.abn}</span>}
                                        {p.contact && <span>{p.contact}</span>}
                                        <span className="party-id-chip" title="Copy party ID" onClick={() => navigator.clipboard?.writeText(p.party_id)}>
                                            {p.party_id.slice(0, 16)}…
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
