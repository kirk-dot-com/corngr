import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
    TxSnapshot, TxRef, ActorContext, CreateTxRequest,
    AddLineRequest, ApiResponse, CaioProposal
} from '../types';

// ── Default actor (Phase A: local single-user, hardcoded identity) ──────────
// In Phase B this is derived from the Primary Node key + OS keychain session.
const DEFAULT_ACTOR: ActorContext = {
    pubkey: 'local_node_pubkey_phase_a',
    role: 'finance',
    org_id: 'org_default',
    lamport: 1,
};

function nextActor(actor: ActorContext): ActorContext {
    return { ...actor, lamport: actor.lamport + 1 };
}

// ── CAIO deterministic rules engine ─────────────────────────────────────────

function runCaioRules(transactions: TxSnapshot[]): CaioProposal[] {
    const proposals: CaioProposal[] = [];

    // Rule 1: Reorder proposal — if any tx is a stock_issue draft with move_count=0
    const issueDrafts = transactions.filter(
        t => t.tx_type === 'stock_issue' && t.status === 'draft' && t.move_count === 0
    );
    if (issueDrafts.length > 0) {
        proposals.push({
            id: 'cai-reorder-001',
            type: 'reorder_proposal',
            title: 'Stock Issue Missing Inventory Move',
            rationale: `${issueDrafts.length} stock issue transaction(s) have no inventory moves recorded.`,
            source_fragment: `tx:${issueDrafts[0].tx_id}:hdr`,
        });
    }

    // Rule 2: Draft Invoice — invoice_out with fulfilled moves (move_count > 0, status draft)
    const readyInvoices = transactions.filter(
        t => t.tx_type === 'invoice_out' && t.status === 'draft' && t.move_count > 0
    );
    if (readyInvoices.length > 0) {
        proposals.push({
            id: 'cai-invoice-001',
            type: 'draft_invoice',
            title: 'Invoice Ready to Propose',
            rationale: `${readyInvoices.length} invoice(s) have inventory moves fulfilled and can be proposed for posting.`,
            source_fragment: `tx:${readyInvoices[0].tx_id}:lines`,
            payload: {
                tx_type: 'invoice_out',
                org_id: readyInvoices[0].org_id,
                currency: 'AUD',
                tx_date: new Date().toISOString().slice(0, 10),
            },
        });
    }

    // Rule 3: Anomaly — more than 3 draft transactions stacked without progression
    const staleDrafts = transactions.filter(t => t.status === 'draft');
    if (staleDrafts.length >= 3) {
        proposals.push({
            id: 'cai-anomaly-001',
            type: 'anomaly_flag',
            title: 'Stale Draft Accumulation',
            rationale: `${staleDrafts.length} transactions remain in draft. Review or void stale entries.`,
            source_fragment: `org:${staleDrafts[0].org_id}:indexes`,
        });
    }

    return proposals;
}

function buildMorningBriefing(transactions: TxSnapshot[]): string[] {
    const total = transactions.length;
    const posted = transactions.filter(t => t.status === 'posted').length;
    const drafts = transactions.filter(t => t.status === 'draft').length;
    const moves = transactions.reduce((s, t) => s + t.move_count, 0);

    return [
        `${total} transaction(s) on record — ${posted} posted, ${drafts} in draft.`,
        `${moves} inventory move(s) recorded across all transactions.`,
        posted === total && total > 0
            ? 'All transactions are posted — ledger is clean. ✓'
            : `${total - posted} transaction(s) pending posting action.`,
    ];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface ErpStore {
    transactions: TxSnapshot[];
    auditChainIntact: boolean;
    proposals: CaioProposal[];
    briefingBullets: string[];
    actor: ActorContext;
    loading: boolean;
    error: string | null;
    refreshAll: () => Promise<void>;
    createTx: (req: CreateTxRequest) => Promise<TxRef | null>;
    addLine: (req: AddLineRequest) => Promise<string | null>;
    dismissProposal: (id: string) => void;
}

export function useErpStore(): ErpStore {
    const [transactions, setTransactions] = useState<TxSnapshot[]>([]);
    const [auditChainIntact, setAuditChainIntact] = useState(true);
    const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const actorRef = useRef<ActorContext>(DEFAULT_ACTOR);

    // Populate with demo/seed data on first load (Phase A — no persistent database yet)
    const seedDemoData = useCallback(async () => {
        try {
            // Create a sample invoice_out transaction
            const actor = actorRef.current;
            const createRes = await invoke<ApiResponse<TxRef>>('erp_create_tx', {
                actor,
                req: {
                    tx_type: 'invoice_out',
                    org_id: 'org_default',
                    currency: 'AUD',
                    tx_date: new Date().toISOString().slice(0, 10),
                    description: 'Demo invoice — Phase A seed',
                    site_id: 'primary',
                },
            });
            actorRef.current = nextActor(actor);

            if (createRes.ok && createRes.data) {
                const txId = createRes.data.tx_id;
                const lineActor = actorRef.current;
                await invoke<ApiResponse<string>>('erp_add_line', {
                    actor: lineActor,
                    req: {
                        tx_id: txId,
                        description: 'Widget A — 10 units',
                        qty: 10,
                        unit_price: 99.99,
                        inventory_effect: 'decrease',
                        tax_rate: 0.1,
                    },
                });
                actorRef.current = nextActor(lineActor);
            }

            // Create a draft stock_issue
            const actor2 = actorRef.current;
            await invoke<ApiResponse<TxRef>>('erp_create_tx', {
                actor: actor2,
                req: {
                    tx_type: 'stock_issue',
                    org_id: 'org_default',
                    currency: 'AUD',
                    tx_date: new Date().toISOString().slice(0, 10),
                    description: 'Warehouse pick — Phase A seed',
                    site_id: 'primary',
                },
            });
            actorRef.current = nextActor(actor2);
        } catch (e) {
            // Demo seed is best-effort — ERP store may already have data
            console.debug('[ERP] seed skipped (likely already seeded):', e);
        }
    }, []);

    const refreshAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // In Phase A, we list all known tx_ids by iterating the store via snapshot.
            // Phase B: replace with `erp_list_txs(org_id, filters)` query command.
            // For now, we use a window-level cache set by createTx.
            const knownIds: string[] = (window as any).__erp_tx_ids__ ?? [];
            const snaps: TxSnapshot[] = [];
            for (const id of knownIds) {
                const res = await invoke<ApiResponse<TxSnapshot>>('erp_get_tx_snapshot', { txId: id });
                if (res.ok && res.data) snaps.push(res.data);
            }
            setTransactions(snaps);

            // Audit chain
            const chainRes = await invoke<ApiResponse<{ intact: boolean }>>('erp_verify_audit_chain');
            setAuditChainIntact(chainRes.ok ? (chainRes.data?.intact ?? true) : true);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    const createTx = useCallback(async (req: CreateTxRequest): Promise<TxRef | null> => {
        const actor = actorRef.current;
        actorRef.current = nextActor(actor);
        try {
            const res = await invoke<ApiResponse<TxRef>>('erp_create_tx', { actor, req });
            if (res.ok && res.data) {
                const ids: string[] = (window as any).__erp_tx_ids__ ?? [];
                ids.push(res.data.tx_id);
                (window as any).__erp_tx_ids__ = ids;
                await refreshAll();
                return res.data;
            }
            setError(res.error_message ?? 'create_tx failed');
        } catch (e) {
            setError(String(e));
        }
        return null;
    }, [refreshAll]);

    const addLine = useCallback(async (req: AddLineRequest): Promise<string | null> => {
        const actor = actorRef.current;
        actorRef.current = nextActor(actor);
        try {
            const res = await invoke<ApiResponse<string>>('erp_add_line', { actor, req });
            if (res.ok && res.data) {
                await refreshAll();
                return res.data;
            }
            setError(res.error_message ?? 'add_line failed');
        } catch (e) {
            setError(String(e));
        }
        return null;
    }, [refreshAll]);

    const dismissProposal = useCallback((id: string) => {
        setDismissedProposals(prev => new Set([...prev, id]));
    }, []);

    // Seed + initial load
    useEffect(() => {
        (async () => {
            await seedDemoData();
            await refreshAll();
        })();
    }, [seedDemoData, refreshAll]);

    const allProposals = runCaioRules(transactions);
    const proposals = allProposals.filter(p => !dismissedProposals.has(p.id));
    const briefingBullets = buildMorningBriefing(transactions);

    return {
        transactions,
        auditChainIntact,
        proposals,
        briefingBullets,
        actor: actorRef.current,
        loading,
        error,
        refreshAll,
        createTx,
        addLine,
        dismissProposal,
    };
}
