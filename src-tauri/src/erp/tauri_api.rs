use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::erp::audit_log::{self, ErpAuditEntry};
use crate::erp::coa_templates;
use crate::erp::engine::ERP_STORE;
use crate::erp::engine::{self, AccountRecord};
use crate::erp::errors::ErpError;
use crate::erp::ledger;
use crate::erp::post::validate_post;
use crate::erp::types::{
    ActorContext, AddLineRequest, ApprovalAtom, CreateInvMoveRequest, CreateTxRequest, Posting,
    TxRef,
};

// ─── Response wrapper ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T: Serialize> {
    pub ok: bool,
    pub data: Option<T>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        ApiResponse {
            ok: true,
            data: Some(data),
            error_code: None,
            error_message: None,
        }
    }
    pub fn err(e: ErpError) -> ApiResponse<T> {
        ApiResponse {
            ok: false,
            data: None,
            error_code: Some(e.code().to_string()),
            error_message: Some(e.to_string()),
        }
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Create a new transaction (draft status).
#[tauri::command]
pub fn erp_create_tx(actor: ActorContext, req: CreateTxRequest) -> ApiResponse<TxRef> {
    match engine::create_tx(&actor, &req) {
        Ok(tx_ref) => ApiResponse::ok(tx_ref),
        Err(e) => ApiResponse::err(e),
    }
}

/// Add a business line to an existing draft transaction.
#[tauri::command]
pub fn erp_add_line(actor: ActorContext, req: AddLineRequest) -> ApiResponse<String> {
    match engine::add_line(&actor, &req) {
        Ok(line_id) => ApiResponse::ok(line_id),
        Err(e) => ApiResponse::err(e),
    }
}

/// Create an inventory movement linked to a tx line.
#[tauri::command]
pub fn erp_create_invmove(actor: ActorContext, req: CreateInvMoveRequest) -> ApiResponse<String> {
    match engine::create_invmove(&actor, &req) {
        Ok(move_id) => ApiResponse::ok(move_id),
        Err(e) => ApiResponse::err(e),
    }
}

/// Generate draft postings for a transaction.
#[tauri::command]
pub fn erp_generate_postings(_actor: ActorContext, tx_id: String) -> ApiResponse<Vec<Posting>> {
    let store = ERP_STORE.lock().unwrap();

    let tx = match store.transactions.get(&tx_id) {
        Some(t) => t.clone(),
        None => {
            drop(store);
            return ApiResponse::err(ErpError::ValidationFail(format!("tx {} not found", tx_id)));
        }
    };

    let lines: Vec<_> = store
        .lines
        .values()
        .filter(|l| l.tx_id == tx_id)
        .cloned()
        .collect();

    let has_invmoves = store.invmoves.values().any(|m| m.tx_id == tx_id);
    drop(store);

    match ledger::generate_postings(&tx.tx_type, &tx_id, &lines, &tx.currency, has_invmoves) {
        Ok(postings) => ApiResponse::ok(postings),
        Err(e) => ApiResponse::err(e),
    }
}

/// Post a transaction: validates approval, fulfillment, and balance, then marks as posted.
#[tauri::command]
pub fn erp_post_tx(
    actor: ActorContext,
    tx_id: String,
    approvals: Vec<ApprovalAtom>,
    postings: Vec<Posting>,
) -> ApiResponse<TxRef> {
    let store = ERP_STORE.lock().unwrap();

    let tx = match store.transactions.get(&tx_id) {
        Some(t) => t.clone(),
        None => {
            drop(store);
            return ApiResponse::err(ErpError::ValidationFail(format!("tx {} not found", tx_id)));
        }
    };

    let lines: Vec<_> = store
        .lines
        .values()
        .filter(|l| l.tx_id == tx_id)
        .cloned()
        .collect();

    let invmoves: Vec<_> = store
        .invmoves
        .values()
        .filter(|m| m.tx_id == tx_id)
        .cloned()
        .collect();

    drop(store);

    match validate_post(&actor, &tx, &lines, &invmoves, &postings, &approvals) {
        Ok(()) => {
            let mut store = ERP_STORE.lock().unwrap();
            if let Some(t) = store.transactions.get_mut(&tx_id) {
                t.status = crate::erp::types::TxStatus::Posted;
            }
            // Persist finalized postings into the ledger store
            for p in &postings {
                store.postings.insert(p.posting_id.clone(), p.clone());
            }
            let tx_ref = TxRef {
                tx_id: tx_id.clone(),
                org_id: tx.org_id.clone(),
                status: crate::erp::types::TxStatus::Posted,
            };
            ApiResponse::ok(tx_ref)
        }
        Err(e) => ApiResponse::err(e),
    }
}

/// Transition a transaction status: draft→proposed, proposed→approved, or →void.
/// Phase A: no cryptographic approval atom required (single-user local node).
/// Phase B: require a signed ApprovalAtom with actor pubkey.
#[tauri::command]
pub fn erp_transition_status(
    actor: ActorContext,
    tx_id: String,
    target_status: String,
) -> ApiResponse<TxRef> {
    use crate::erp::types::TxStatus;

    let target = match target_status.as_str() {
        "proposed" => TxStatus::Proposed,
        "approved" => TxStatus::Approved,
        "void" => TxStatus::Void,
        other => {
            return ApiResponse::err(ErpError::ValidationFail(format!(
                "unknown target status: {}",
                other
            )))
        }
    };

    let mut store = ERP_STORE.lock().unwrap();

    let tx = match store.transactions.get_mut(&tx_id) {
        Some(t) => t,
        None => {
            return ApiResponse::err(ErpError::ValidationFail(format!("tx {} not found", tx_id)))
        }
    };

    // Enforce valid state machine transitions
    let valid = matches!(
        (&tx.status, &target),
        (TxStatus::Draft, TxStatus::Proposed)
            | (TxStatus::Proposed, TxStatus::Approved)
            | (TxStatus::Draft, TxStatus::Void)
            | (TxStatus::Proposed, TxStatus::Void)
    );
    if !valid {
        return ApiResponse::err(ErpError::InvalidStatus(
            tx.status.as_str().to_string(),
            target.as_str().to_string(),
        ));
    }

    // ABAC: finance/manager/owner_admin can approve; staff can propose
    if matches!(target, TxStatus::Approved) {
        let policy_ctx = crate::erp::types::PolicyContext {
            org_id: tx.org_id.clone(),
            tx_id: Some(tx_id.clone()),
            tx_status: Some(tx.status.clone()),
        };
        if let Err(e) =
            crate::erp::abac::check_abac(&actor, &crate::erp::abac::Action::TxPost, &policy_ctx)
        {
            return ApiResponse::err(e);
        }
    }

    tx.status = target.clone();
    let org_id = tx.org_id.clone();
    drop(store);

    ApiResponse::ok(TxRef {
        tx_id,
        org_id,
        status: target,
    })
}

/// Get a transaction snapshot (header + lines + invmoves count).
#[derive(Debug, Serialize, Deserialize)]
pub struct TxSnapshot {
    pub tx_id: String,
    pub org_id: String,
    pub tx_type: String,
    pub status: String,
    pub site_id: String,
    pub line_count: usize,
    pub move_count: usize,
}

#[tauri::command]
pub fn erp_get_tx_snapshot(tx_id: String) -> ApiResponse<TxSnapshot> {
    let store = ERP_STORE.lock().unwrap();

    let tx = match store.transactions.get(&tx_id) {
        Some(t) => t.clone(),
        None => {
            return ApiResponse::err(ErpError::ValidationFail(format!("tx {} not found", tx_id)));
        }
    };

    let line_count = store.lines.values().filter(|l| l.tx_id == tx_id).count();
    let move_count = store.invmoves.values().filter(|m| m.tx_id == tx_id).count();

    ApiResponse::ok(TxSnapshot {
        tx_id: tx.tx_id,
        org_id: tx.org_id,
        tx_type: tx.tx_type.as_str().to_string(),
        status: tx.status.as_str().to_string(),
        site_id: tx.site_id,
        line_count,
        move_count,
    })
}

/// List all transactions for an org (Phase A: in-memory scan; Phase B: index query).
/// Returns TxSnapshot array sorted by lamport descending (newest first).
#[tauri::command]
pub fn erp_list_txs(org_id: String) -> ApiResponse<Vec<TxSnapshot>> {
    let store = ERP_STORE.lock().unwrap();

    let mut snapshots: Vec<TxSnapshot> = store
        .transactions
        .values()
        .filter(|tx| tx.org_id == org_id)
        .map(|tx| {
            let line_count = store.lines.values().filter(|l| l.tx_id == tx.tx_id).count();
            let move_count = store
                .invmoves
                .values()
                .filter(|m| m.tx_id == tx.tx_id)
                .count();
            TxSnapshot {
                tx_id: tx.tx_id.clone(),
                org_id: tx.org_id.clone(),
                tx_type: tx.tx_type.as_str().to_string(),
                status: tx.status.as_str().to_string(),
                site_id: tx.site_id.clone(),
                line_count,
                move_count,
            }
        })
        .collect();

    // Newest first — sort by tx_id (ULID-ordered) descending
    snapshots.sort_by(|a, b| b.tx_id.cmp(&a.tx_id));

    ApiResponse::ok(snapshots)
}

// ─── M9: Party Master ────────────────────────────────────────────────────────

use crate::erp::types::{CreatePartyRequest, Party, PartyKind};

/// Create a new party (customer / supplier / employee / other).
/// Returns the new party_id on success.
#[tauri::command]
pub fn erp_create_party(_actor: ActorContext, req: CreatePartyRequest) -> ApiResponse<String> {
    if req.name.trim().is_empty() {
        return ApiResponse::err(ErpError::ValidationFail(
            "party name must not be empty".to_string(),
        ));
    }

    let party_id = format!("party_{}", Uuid::new_v4().simple());
    let now_ms = chrono::Utc::now().timestamp_millis();

    let party = Party {
        party_id: party_id.clone(),
        org_id: req.org_id.clone(),
        name: req.name.trim().to_string(),
        kind: PartyKind::from_str(&req.kind),
        email: req.email.filter(|s| !s.is_empty()),
        contact: req.contact.filter(|s| !s.is_empty()),
        abn: req.abn.filter(|s| !s.is_empty()),
        created_at_ms: now_ms,
    };

    // Phase A: direct store write. Phase B: full signed MapSet envelope via engine.
    let mut store = ERP_STORE.lock().unwrap();
    store.parties.insert(party_id.clone(), party);

    ApiResponse::ok(party_id)
}

/// List all parties for an org, sorted by name ascending.
#[tauri::command]
pub fn erp_list_parties(org_id: String) -> ApiResponse<Vec<Party>> {
    let store = ERP_STORE.lock().unwrap();

    let mut parties: Vec<Party> = store
        .parties
        .values()
        .filter(|p| p.org_id == org_id)
        .cloned()
        .collect();

    parties.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    ApiResponse::ok(parties)
}

/// Verify audit chain integrity.
#[derive(Debug, Serialize, Deserialize)]
pub struct ChainVerifyResult {
    pub intact: bool,
}

#[tauri::command]
pub fn erp_verify_audit_chain() -> ApiResponse<ChainVerifyResult> {
    ApiResponse::ok(ChainVerifyResult {
        intact: audit_log::verify_chain(),
    })
}

// ─── M4: Audit log read ───────────────────────────────────────────────────────

/// A UI-friendly view of a single audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntryView {
    pub mutation_id: String,
    pub actor_pubkey: String,
    pub issued_at_ms: i64,
    pub op_count: usize,
    pub prev_hash: String,
    pub content_hash: String,
    pub chain_hash: String,
    pub op_summary: String,
}

fn entry_to_view(entry: &ErpAuditEntry) -> AuditEntryView {
    let env = &entry.envelope;
    let op_summary = env
        .ops
        .first()
        .map(|op| match op {
            crate::erp::types::Op::MapSet {
                fragment_id,
                key,
                value,
            } => format!("MapSet {} .{} = {}", fragment_id, key, value),
            crate::erp::types::Op::ArrayInsert { fragment_id, .. } => {
                format!("ArrayInsert {}", fragment_id)
            }
            crate::erp::types::Op::ArrayDelete { fragment_id, .. } => {
                format!("ArrayDelete {}", fragment_id)
            }
            crate::erp::types::Op::MapDel { fragment_id, key } => {
                format!("MapDel {} .{}", fragment_id, key)
            }
            // LinkAdd, ProposalCreate and future Phase B ops
            _ => "(complex op)".to_string(),
        })
        .unwrap_or_else(|| "(no ops)".to_string());

    AuditEntryView {
        mutation_id: env.mutation_id.clone(),
        actor_pubkey: env.actor_pubkey.clone(),
        issued_at_ms: env.issued_at_ms,
        op_count: env.ops.len(),
        prev_hash: env.prev_hash.clone(),
        content_hash: env.content_hash.clone(),
        chain_hash: entry.chain_hash.clone(),
        op_summary,
    }
}

/// Read last N audit log entries, newest first.
#[tauri::command]
pub fn erp_get_audit_log(limit: usize) -> ApiResponse<Vec<AuditEntryView>> {
    match audit_log::read_log(limit) {
        Ok(entries) => ApiResponse::ok(entries.iter().map(entry_to_view).collect()),
        Err(e) => ApiResponse::err(ErpError::ValidationFail(e.to_string())),
    }
}

// ─── M4: Time travel ─────────────────────────────────────────────────────────

/// A simplified snapshot of ERP state reconstructed at a point in time.
#[derive(Debug, Serialize, Deserialize)]
pub struct TimeTravelSnapshot {
    pub as_of_ms: i64,
    pub tx_count: usize,
    pub posted_count: usize,
    pub mutation_count: usize,
    pub chain_intact: bool,
    pub as_of_label: String,
}

/// Replay the audit log up to `target_ts_ms` and return a reconstructed state summary.
/// Phase A: compute-on-replay, no checkpoints.
/// Phase B: checkpoint every N mutations for O(1) reconstruction.
#[tauri::command]
pub fn erp_time_travel(target_ts_ms: i64) -> ApiResponse<TimeTravelSnapshot> {
    // Read all entries up to the target timestamp
    let entries = match audit_log::read_log_bounded(0, target_ts_ms) {
        Ok(e) => e,
        Err(err) => return ApiResponse::err(ErpError::ValidationFail(err.to_string())),
    };

    let mutation_count = entries.len();

    // Reconstruct minimal state: count distinct tx_ids and estimate posted count
    // by scanning MapSet ops for status=posted
    let mut tx_ids = std::collections::HashSet::new();
    let mut posted_ids = std::collections::HashSet::new();

    for entry in &entries {
        for op in &entry.envelope.ops {
            if let crate::erp::types::Op::MapSet {
                fragment_id,
                key,
                value,
            } = op
            {
                // fragment_id pattern: "tx:{uuid}:hdr"
                if fragment_id.starts_with("tx:") && fragment_id.ends_with(":hdr") {
                    let parts: Vec<&str> = fragment_id.split(':').collect();
                    if parts.len() >= 2 {
                        let tx_id = parts[1].to_string();
                        tx_ids.insert(tx_id.clone());
                        if key == "status" && value.as_str() == Some("posted") {
                            posted_ids.insert(tx_id);
                        }
                    }
                }
            }
        }
    }

    let as_of_label = {
        use chrono::{TimeZone, Utc};
        match Utc.timestamp_millis_opt(target_ts_ms) {
            chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
            _ => "unknown".to_string(),
        }
    };

    ApiResponse::ok(TimeTravelSnapshot {
        as_of_ms: target_ts_ms,
        tx_count: tx_ids.len(),
        posted_count: posted_ids.len(),
        mutation_count,
        chain_intact: audit_log::verify_chain(),
        as_of_label,
    })
}

// ─── M5: Chart of Accounts ───────────────────────────────────────────────────

/// Seed the Chart of Accounts from a named template.
/// `template_name`: "general_sme_au_gst" | "services_low_inventory" | "product_manufacturing"
/// Returns the number of accounts seeded.
#[tauri::command]
pub fn erp_seed_coa(actor: ActorContext, template_name: String) -> ApiResponse<usize> {
    // ABAC: only owner_admin / finance can seed CoA
    use crate::erp::types::PolicyContext;
    let ctx = PolicyContext {
        org_id: actor.org_id.clone(),
        tx_id: None,
        tx_status: None,
    };
    if let Err(e) = crate::erp::abac::check_abac(&actor, &crate::erp::abac::Action::TxCreate, &ctx)
    {
        return ApiResponse::err(e);
    }

    let ops = match template_name.as_str() {
        "general_sme_au_gst" => coa_templates::general_sme_au_gst(),
        "services_low_inventory" => coa_templates::services_low_inventory(),
        "product_manufacturing" => coa_templates::product_manufacturing(),
        other => {
            return ApiResponse::err(ErpError::ValidationFail(format!(
                "unknown CoA template: {}",
                other
            )))
        }
    };

    let mut store = ERP_STORE.lock().unwrap();
    engine::seed_coa_ops(&ops, &mut store.accounts);
    let count = store.accounts.len();
    ApiResponse::ok(count)
}

/// UI-friendly CoA account view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountView {
    pub code: String,
    pub name: String,
    pub acct_type: String,
    pub normal_balance: String,
}

impl From<&AccountRecord> for AccountView {
    fn from(r: &AccountRecord) -> Self {
        AccountView {
            code: r.code.clone(),
            name: r.name.clone(),
            acct_type: r.acct_type.clone(),
            normal_balance: r.normal_balance.clone(),
        }
    }
}

/// List all seeded CoA accounts sorted by account code.
#[tauri::command]
pub fn erp_list_coa() -> ApiResponse<Vec<AccountView>> {
    let store = ERP_STORE.lock().unwrap();
    let mut accounts: Vec<AccountView> = store.accounts.values().map(AccountView::from).collect();
    accounts.sort_by(|a, b| a.code.cmp(&b.code));
    ApiResponse::ok(accounts)
}

// ─── M5: Postings Ledger ─────────────────────────────────────────────────────

/// Per-account balance rollup for the Postings Ledger view.
#[derive(Debug, Serialize, Deserialize)]
pub struct LedgerAccountRow {
    pub account_id: String,
    pub account_name: String,
    pub acct_type: String,
    pub normal_balance: String,
    pub total_debit: f64,
    pub total_credit: f64,
    pub balance: f64,
    pub tx_count: usize,
}

/// Returns per-account balance rollup from all committed postings in ErpStore::postings.
#[tauri::command]
pub fn erp_get_ledger_summary() -> ApiResponse<Vec<LedgerAccountRow>> {
    let store = ERP_STORE.lock().unwrap();

    // Aggregate postings by account_id
    let mut agg: std::collections::HashMap<String, (f64, f64, usize)> =
        std::collections::HashMap::new();
    for posting in store.postings.values() {
        let entry = agg
            .entry(posting.account_id.clone())
            .or_insert((0.0, 0.0, 0));
        entry.0 += posting.debit_amount;
        entry.1 += posting.credit_amount;
        entry.2 += 1;
    }

    let mut rows: Vec<LedgerAccountRow> = agg
        .into_iter()
        .map(|(acct_id, (dr, cr, cnt))| {
            // Try to resolve account name from seeded CoA
            // Symbolic ledger IDs (e.g. "accounts_receivable") are matched by name lookup
            let found = store.accounts.values().find(|a| {
                a.code == acct_id
                    || a.name.to_lowercase().replace(' ', "_") == acct_id.to_lowercase()
            });
            let (account_name, acct_type, normal_balance) = found
                .map(|a| {
                    (
                        a.name.clone(),
                        a.acct_type.clone(),
                        a.normal_balance.clone(),
                    )
                })
                .unwrap_or_else(|| (acct_id.clone(), "unknown".to_string(), "debit".to_string()));

            // Net balance: positive if on the normal side
            let balance = if normal_balance == "debit" {
                dr - cr
            } else {
                cr - dr
            };
            LedgerAccountRow {
                account_id: acct_id,
                account_name,
                acct_type,
                normal_balance,
                total_debit: (dr * 100.0).round() / 100.0,
                total_credit: (cr * 100.0).round() / 100.0,
                balance: (balance * 100.0).round() / 100.0,
                tx_count: cnt,
            }
        })
        .collect();

    // Sort: by acct_type grouping then by account_id
    rows.sort_by(|a, b| {
        let type_ord = |t: &str| match t {
            "asset" => 0,
            "liability" => 1,
            "equity" => 2,
            "income" => 3,
            "expense" => 4,
            _ => 5,
        };
        type_ord(&a.acct_type)
            .cmp(&type_ord(&b.acct_type))
            .then(a.account_id.cmp(&b.account_id))
    });

    ApiResponse::ok(rows)
}

// ─── M6: Shatter Import ───────────────────────────────────────────────────────

/// A single row from a Shatter import (post column-mapping).
#[derive(Debug, Deserialize)]
pub struct BulkImportRow {
    pub tx_type: String,
    pub tx_date: String,
    pub description: String,
    pub org_id: String,
    pub currency: String,
    pub party_id: Option<String>,
    pub ref_number: Option<String>,
    pub line_description: Option<String>,
    pub qty: Option<f64>,
    pub unit_price: Option<f64>,
    pub tax_rate: Option<f64>,
    pub provenance_label: String,
}

/// Result summary of a bulk import run.
#[derive(Debug, Serialize)]
pub struct BulkImportResult {
    pub imported_count: usize,
    pub failed_count: usize,
    pub tx_ids: Vec<String>,
    pub errors: Vec<String>,
}

/// Bulk-import rows from a Shatter import (CSV/XLSX → column-mapped rows).
/// Each row creates a signed TxAtom via existing engine commands.
/// Returns a summary of success/failure counts.
#[tauri::command]
pub fn erp_bulk_import(
    actor: ActorContext,
    rows: Vec<BulkImportRow>,
) -> ApiResponse<BulkImportResult> {
    use crate::erp::types::{AddLineRequest, CreateTxRequest, TxType};

    let mut tx_ids: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut lamport = actor.lamport;

    for (i, row) in rows.into_iter().enumerate() {
        // Validate tx_type
        let _tx_type = match TxType::from_str(&row.tx_type) {
            Ok(t) => t,
            Err(e) => {
                errors.push(format!("row {}: {}", i, e));
                continue;
            }
        };

        // Build description with provenance
        let desc = format!("{} — {}", row.description, row.provenance_label);

        let create_req = CreateTxRequest {
            tx_type: row.tx_type.clone(),
            org_id: row.org_id.clone(),
            party_id: row.party_id.clone(),
            currency: row.currency.clone(),
            ref_number: row.ref_number.clone(),
            description: Some(desc),
            tx_date: row.tx_date.clone(),
            site_id: Some("primary".to_string()),
        };

        // Create actor with incrementing lamport
        let import_actor = ActorContext {
            pubkey: actor.pubkey.clone(),
            role: actor.role.clone(),
            org_id: actor.org_id.clone(),
            lamport,
        };
        lamport += 1;

        let tx_ref = match engine::create_tx(&import_actor, &create_req) {
            Ok(r) => r,
            Err(e) => {
                errors.push(format!("row {}: create_tx: {}", i, e));
                continue;
            }
        };

        // Add line if qty + unit_price provided
        if let (Some(qty), Some(price)) = (row.qty, row.unit_price) {
            let line_req = AddLineRequest {
                tx_id: tx_ref.tx_id.clone(),
                item_id: None,
                account_id: None,
                description: row.line_description.clone(),
                qty,
                unit_price: price,
                inventory_effect: "none".to_string(),
                tax_code: Some("GST".to_string()),
                tax_rate: row.tax_rate,
            };
            let line_actor = ActorContext {
                pubkey: actor.pubkey.clone(),
                role: actor.role.clone(),
                org_id: actor.org_id.clone(),
                lamport,
            };
            lamport += 1;
            if let Err(e) = engine::add_line(&line_actor, &line_req) {
                errors.push(format!("row {}: add_line: {}", i, e));
                // tx still created — continue
            }
        }

        tx_ids.push(tx_ref.tx_id);
    }

    ApiResponse::ok(BulkImportResult {
        imported_count: tx_ids.len(),
        failed_count: errors.len(),
        tx_ids,
        errors,
    })
}
