// ── ERP Type Definitions (mirrors Rust erp/types.rs) ──────────────────────

export interface TxRef {
  tx_id: string;
  org_id: string;
  status: TxStatus;
}

export type TxStatus = 'draft' | 'proposed' | 'approved' | 'posted' | 'void';
export type TxType =
  | 'invoice_out' | 'invoice_in'
  | 'payment_in' | 'payment_out'
  | 'stock_receipt' | 'stock_issue' | 'stock_adjust'
  | 'journal' | 'credit_note' | 'debit_note';

export type Role = 'owner_admin' | 'manager' | 'finance' | 'staff' | 'auditor';

export interface ActorContext {
  pubkey: string;
  role: Role;
  org_id: string;
  lamport: number;
}

export interface TxSnapshot {
  tx_id: string;
  org_id: string;
  tx_type: TxType;
  status: TxStatus;
  site_id: string;
  line_count: number;
  move_count: number;
}

export interface TxLine {
  line_id: string;
  tx_id: string;
  item_id?: string;
  account_id?: string;
  description?: string;
  qty: number;
  unit_price: number;
  inventory_effect: 'increase' | 'decrease' | 'none';
  move_ids: string[];
  tax_code?: string;
  tax_rate: number;
}

export interface Posting {
  posting_id: string;
  tx_id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  currency: string;
  description?: string;
  status: string;
  generated_by: string;
}

export interface CreateTxRequest {
  tx_type: string;
  org_id: string;
  party_id?: string;
  currency: string;
  ref_number?: string;
  description?: string;
  tx_date: string;
  site_id?: string;
}

export interface AddLineRequest {
  tx_id: string;
  item_id?: string;
  account_id?: string;
  description?: string;
  qty: number;
  unit_price: number;
  inventory_effect: string;
  tax_code?: string;
  tax_rate?: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error_code?: string;
  error_message?: string;
}

// ── CAIO types ────────────────────────────────────────────

export type ProposalType = 'reorder_proposal' | 'anomaly_flag' | 'draft_invoice' | 'briefing';

export interface CaioProposal {
  id: string;
  type: ProposalType;
  title: string;
  rationale: string;
  source_fragment: string;
  payload?: Partial<CreateTxRequest>;
}

export interface CreateInvMoveRequest {
  tx_id: string;
  tx_line_id: string;
  item_id: string;
  qty_delta: number;
  location_id?: string;
}

export interface ApprovalAtom {
  approval_id: string;
  tx_id: string;
  approval_type: string;
  actor_pubkey: string;
  signature_ref: string;
  issued_at_ms: number;
}
