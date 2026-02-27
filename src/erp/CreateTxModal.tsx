import React, { useState, useCallback } from 'react';
import { useErpStore } from './store/useErpStore';
import type { CreateTxRequest, TxType } from './types';

interface CreateTxModalProps {
    onClose: () => void;
}

const TX_TYPES: { value: TxType; label: string }[] = [
    { value: 'invoice_out', label: 'Invoice Out (Sales Invoice)' },
    { value: 'invoice_in', label: 'Invoice In (Purchase Invoice)' },
    { value: 'payment_in', label: 'Payment In (Customer Payment)' },
    { value: 'payment_out', label: 'Payment Out (Supplier Payment)' },
    { value: 'stock_receipt', label: 'Stock Receipt' },
    { value: 'stock_issue', label: 'Stock Issue' },
    { value: 'stock_adjust', label: 'Stock Adjustment' },
    { value: 'journal', label: 'Journal Entry' },
    { value: 'credit_note', label: 'Credit Note' },
    { value: 'debit_note', label: 'Debit Note' },
];

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'SGD'];

export const CreateTxModal: React.FC<CreateTxModalProps> = ({ onClose }) => {
    const store = useErpStore();

    const today = new Date().toISOString().slice(0, 10);
    const [txType, setTxType] = useState<TxType>('invoice_out');
    const [description, setDescription] = useState('');
    const [txDate, setTxDate] = useState(today);
    const [currency, setCurrency] = useState('AUD');
    const [refNumber, setRefNumber] = useState('');
    const [siteId, setSiteId] = useState('primary');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);

        const req: CreateTxRequest = {
            tx_type: txType,
            org_id: 'org_default',
            description: description || undefined,
            currency,
            tx_date: txDate,
            ref_number: refNumber || undefined,
            site_id: siteId || 'primary',
        };

        const result = await store.createTx(req);
        setBusy(false);
        if (result) {
            onClose();
        } else {
            setErr('Failed to create transaction — check your inputs.');
        }
    }, [store, txType, description, currency, txDate, refNumber, siteId, onClose]);

    // Close on overlay click or ESC
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    return (
        <div
            className="modal-overlay"
            onClick={handleOverlayClick}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Create New Transaction"
        >
            <div className="create-tx-modal">
                {/* Header */}
                <div className="modal-header">
                    <div>
                        <div className="modal-title">＋ New Transaction</div>
                        <div className="modal-subtitle">Create a new draft transaction</div>
                    </div>
                    <button className="drill-close" onClick={onClose} id="create-tx-close">✕</button>
                </div>

                {/* Form */}
                <form className="modal-body" onSubmit={handleSubmit} id="create-tx-form">
                    <div className="modal-field">
                        <label htmlFor="tx-type">Transaction Type</label>
                        <select
                            id="tx-type"
                            value={txType}
                            onChange={e => setTxType(e.target.value as TxType)}
                            className="modal-select"
                        >
                            {TX_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="modal-field">
                        <label htmlFor="tx-description">Description</label>
                        <input
                            id="tx-description"
                            type="text"
                            className="modal-input"
                            placeholder="e.g. Sales to Acme Corp — March order"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="modal-field-row">
                        <div className="modal-field">
                            <label htmlFor="tx-date">Date</label>
                            <input
                                id="tx-date"
                                type="date"
                                className="modal-input"
                                value={txDate}
                                onChange={e => setTxDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="modal-field">
                            <label htmlFor="tx-currency">Currency</label>
                            <select
                                id="tx-currency"
                                className="modal-select"
                                value={currency}
                                onChange={e => setCurrency(e.target.value)}
                            >
                                {CURRENCIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="modal-field-row">
                        <div className="modal-field">
                            <label htmlFor="tx-ref">Reference #</label>
                            <input
                                id="tx-ref"
                                type="text"
                                className="modal-input"
                                placeholder="INV-2026-001 (optional)"
                                value={refNumber}
                                onChange={e => setRefNumber(e.target.value)}
                            />
                        </div>
                        <div className="modal-field">
                            <label htmlFor="tx-site">Site / Branch</label>
                            <input
                                id="tx-site"
                                type="text"
                                className="modal-input"
                                placeholder="primary"
                                value={siteId}
                                onChange={e => setSiteId(e.target.value)}
                            />
                        </div>
                    </div>

                    {err && <p className="form-error">{err}</p>}

                    <div className="modal-footer">
                        <button
                            type="submit"
                            className="action-btn post"
                            id="create-tx-submit"
                            disabled={busy}
                        >
                            {busy ? 'Creating…' : '＋ Create Draft'}
                        </button>
                        <button
                            type="button"
                            className="action-btn void"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
