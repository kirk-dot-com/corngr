use chrono::Utc;
use std::sync::Mutex;
use uuid::Uuid;

use crate::erp::abac::{check_abac, Action};
use crate::erp::audit_log;
use crate::erp::envelope::{get_actor_pubkey_hex, MutationEnvelope};
use crate::erp::errors::ErpError;
use crate::erp::fragments;
use crate::erp::replay::ReplayGuard;
use crate::erp::types::{
    ActorContext, AddLineRequest, CreateInvMoveRequest, CreateTxRequest, InvMove, InventoryEffect,
    Op, PolicyContext, TxHeader, TxLine, TxRef, TxStatus, TxType,
};

/// In-memory ERP document store.
/// Phase A: single org, single in-process doc (no yrs CRDT cross-device sync for ERP data yet).
/// Phase B: replace with shared yrs Doc managed by Primary Mode.
pub struct ErpStore {
    pub transactions: std::collections::HashMap<String, TxHeader>,
    pub lines: std::collections::HashMap<String, TxLine>, // key: line_id
    pub invmoves: std::collections::HashMap<String, InvMove>, // key: move_id
    pub replay: ReplayGuard,
    /// Most recently seen envelope hash per actor (prev_hash chain)
    pub actor_prev_hash: std::collections::HashMap<String, String>,
}

impl ErpStore {
    pub fn new() -> Self {
        Self {
            transactions: Default::default(),
            lines: Default::default(),
            invmoves: Default::default(),
            replay: ReplayGuard::new(),
            actor_prev_hash: Default::default(),
        }
    }
}

lazy_static::lazy_static! {
    pub static ref ERP_STORE: Mutex<ErpStore> = Mutex::new(ErpStore::new());
}

// ─── create_tx ──────────────────────────────────────────────────────────────

/// Create a new transaction in draft status.
/// Steps: ABAC → build ops → sign envelope → store → audit log → return TxRef.
pub fn create_tx(actor: &ActorContext, req: &CreateTxRequest) -> Result<TxRef, ErpError> {
    // 1. Validate tx_type
    let tx_type = TxType::from_str(&req.tx_type)?;

    // 2. ABAC
    let policy_ctx = PolicyContext {
        org_id: req.org_id.clone(),
        tx_id: None,
        tx_status: None,
    };
    check_abac(actor, &Action::TxCreate, &policy_ctx)?;

    // 3. Build header
    let tx_id = Uuid::new_v4().to_string();
    let now_ms = Utc::now().timestamp_millis();
    let header = TxHeader {
        tx_id: tx_id.clone(),
        org_id: req.org_id.clone(),
        tx_type,
        status: TxStatus::Draft,
        party_id: req.party_id.clone(),
        currency: req.currency.clone(),
        ref_number: req.ref_number.clone(),
        description: req.description.clone(),
        tx_date: req.tx_date.clone(),
        created_at_ms: now_ms,
        created_by_pubkey: actor.pubkey.clone(),
        site_id: req.site_id.clone().unwrap_or_else(|| "primary".to_string()),
    };

    // 4. Build ops
    let hdr_fragment = fragments::tx_hdr_id(&tx_id);
    let ops = vec![
        Op::MapSet {
            fragment_id: hdr_fragment.clone(),
            key: "tx_id".to_string(),
            value: serde_json::json!(header.tx_id),
        },
        Op::MapSet {
            fragment_id: hdr_fragment.clone(),
            key: "tx_type".to_string(),
            value: serde_json::json!(header.tx_type.as_str()),
        },
        Op::MapSet {
            fragment_id: hdr_fragment.clone(),
            key: "status".to_string(),
            value: serde_json::json!("draft"),
        },
        Op::MapSet {
            fragment_id: hdr_fragment.clone(),
            key: "org_id".to_string(),
            value: serde_json::json!(header.org_id),
        },
        Op::MapSet {
            fragment_id: hdr_fragment.clone(),
            key: "currency".to_string(),
            value: serde_json::json!(header.currency),
        },
        Op::MapSet {
            fragment_id: hdr_fragment.clone(),
            key: "tx_date".to_string(),
            value: serde_json::json!(header.tx_date),
        },
        Op::MapSet {
            fragment_id: hdr_fragment,
            key: "site_id".to_string(),
            value: serde_json::json!(header.site_id),
        },
    ];

    // 5. Sign envelope + replay check
    let mutation_id = Uuid::new_v4().to_string();
    let policy_ctx2 = PolicyContext {
        org_id: req.org_id.clone(),
        tx_id: Some(tx_id.clone()),
        tx_status: Some(TxStatus::Draft),
    };

    let mut store = ERP_STORE.lock().unwrap();
    let prev_hash = store
        .actor_prev_hash
        .get(&actor.pubkey)
        .cloned()
        .unwrap_or_else(|| "genesis".to_string());

    store
        .replay
        .check_and_record(&actor.pubkey, &mutation_id, actor.lamport)?;

    let envelope = MutationEnvelope::sign(mutation_id, actor, ops, policy_ctx2, prev_hash)?;

    store
        .actor_prev_hash
        .insert(actor.pubkey.clone(), envelope.envelope_hash());

    // 6. Store
    store.transactions.insert(tx_id.clone(), header);

    // 7. Audit log (best-effort; don't fail the tx if log write fails)
    drop(store);
    let _ = audit_log::append(&envelope);

    Ok(TxRef {
        tx_id,
        org_id: req.org_id.clone(),
        status: TxStatus::Draft,
    })
}

// ─── add_line ───────────────────────────────────────────────────────────────

/// Add a business line to an existing draft transaction.
pub fn add_line(actor: &ActorContext, req: &AddLineRequest) -> Result<String, ErpError> {
    let mut store = ERP_STORE.lock().unwrap();

    // Fetch tx header
    let tx = store
        .transactions
        .get(&req.tx_id)
        .ok_or_else(|| ErpError::ValidationFail(format!("tx {} not found", req.tx_id)))?
        .clone();

    // ABAC check
    let policy_ctx = PolicyContext {
        org_id: tx.org_id.clone(),
        tx_id: Some(tx.tx_id.clone()),
        tx_status: Some(tx.status.clone()),
    };
    check_abac(actor, &Action::TxEdit, &policy_ctx)?;

    // Block edits on posted tx
    if tx.status == TxStatus::Posted {
        return Err(ErpError::LineImmutable(req.tx_id.clone()));
    }

    let line_id = Uuid::new_v4().to_string();
    let inv_effect = InventoryEffect::from_str(req.inventory_effect.as_deref().unwrap_or("none"));

    let line = TxLine {
        line_id: line_id.clone(),
        tx_id: req.tx_id.clone(),
        item_id: req.item_id.clone(),
        account_id: req.account_id.clone(),
        description: req.description.clone(),
        qty: req.qty,
        unit_price: req.unit_price,
        inventory_effect: inv_effect,
        move_ids: vec![],
        tax_code: req.tax_code.clone(),
        tax_rate: req.tax_rate.unwrap_or(0.0),
    };

    // Build ops
    let line_frag = fragments::txline_id(&line_id);
    let lines_frag = fragments::tx_lines_id(&req.tx_id);
    let ops = vec![
        Op::MapSet {
            fragment_id: line_frag.clone(),
            key: "data".to_string(),
            value: serde_json::to_value(&line).unwrap_or_default(),
        },
        Op::ArrayInsert {
            fragment_id: lines_frag,
            index: 0,
            values: vec![serde_json::json!(line_id)],
        },
    ];

    let mutation_id = Uuid::new_v4().to_string();
    let policy_ctx2 = PolicyContext {
        org_id: tx.org_id.clone(),
        tx_id: Some(tx.tx_id.clone()),
        tx_status: Some(tx.status.clone()),
    };
    let prev_hash = store
        .actor_prev_hash
        .get(&actor.pubkey)
        .cloned()
        .unwrap_or_else(|| "genesis".to_string());

    store
        .replay
        .check_and_record(&actor.pubkey, &mutation_id, actor.lamport)?;

    let envelope = MutationEnvelope::sign(mutation_id, actor, ops, policy_ctx2, prev_hash)?;
    store
        .actor_prev_hash
        .insert(actor.pubkey.clone(), envelope.envelope_hash());
    store.lines.insert(line_id.clone(), line);

    drop(store);
    let _ = audit_log::append(&envelope);

    Ok(line_id)
}

// ─── create_invmove ─────────────────────────────────────────────────────────

/// Create an inventory movement linked to a tx line.
pub fn create_invmove(
    actor: &ActorContext,
    req: &CreateInvMoveRequest,
) -> Result<String, ErpError> {
    let mut store = ERP_STORE.lock().unwrap();

    let tx = store
        .transactions
        .get(&req.tx_id)
        .ok_or_else(|| ErpError::ValidationFail(format!("tx {} not found", req.tx_id)))?
        .clone();

    let line = store
        .lines
        .get(&req.tx_line_id)
        .ok_or_else(|| ErpError::ValidationFail(format!("line {} not found", req.tx_line_id)))?
        .clone();

    // item_id must match
    if let Some(ref line_item) = line.item_id {
        if req.item_id != *line_item {
            return Err(ErpError::ItemMismatch(
                req.item_id.clone(),
                line_item.clone(),
            ));
        }
    }

    // qty_delta sign must match inventory_effect
    validate_qty_sign(req.qty_delta, &line.inventory_effect)?;

    let policy_ctx = PolicyContext {
        org_id: tx.org_id.clone(),
        tx_id: Some(tx.tx_id.clone()),
        tx_status: Some(tx.status.clone()),
    };
    check_abac(actor, &Action::InvMoveCreate, &policy_ctx)?;

    let move_id = Uuid::new_v4().to_string();
    let now_ms = Utc::now().timestamp_millis();

    let invmove = InvMove {
        move_id: move_id.clone(),
        tx_id: req.tx_id.clone(),
        tx_line_id: req.tx_line_id.clone(),
        item_id: req.item_id.clone(),
        qty_delta: req.qty_delta,
        location_id: req.location_id.clone(),
        moved_at_ms: now_ms,
        moved_by_pubkey: actor.pubkey.clone(),
        site_id: req.site_id.clone().unwrap_or_else(|| "primary".to_string()),
    };

    let move_frag = fragments::invmove_id(&move_id);
    let ops = vec![Op::MapSet {
        fragment_id: move_frag,
        key: "data".to_string(),
        value: serde_json::to_value(&invmove).unwrap_or_default(),
    }];

    let mutation_id = Uuid::new_v4().to_string();
    let policy_ctx2 = PolicyContext {
        org_id: tx.org_id.clone(),
        tx_id: Some(tx.tx_id.clone()),
        tx_status: Some(tx.status.clone()),
    };
    let prev_hash = store
        .actor_prev_hash
        .get(&actor.pubkey)
        .cloned()
        .unwrap_or_else(|| "genesis".to_string());

    store
        .replay
        .check_and_record(&actor.pubkey, &mutation_id, actor.lamport)?;

    let envelope = MutationEnvelope::sign(mutation_id, actor, ops, policy_ctx2, prev_hash)?;
    store
        .actor_prev_hash
        .insert(actor.pubkey.clone(), envelope.envelope_hash());
    store.invmoves.insert(move_id.clone(), invmove);

    // Update line's move_ids
    if let Some(l) = store.lines.get_mut(&req.tx_line_id) {
        l.move_ids.push(move_id.clone());
    }

    drop(store);
    let _ = audit_log::append(&envelope);

    Ok(move_id)
}

fn validate_qty_sign(qty_delta: f64, effect: &InventoryEffect) -> Result<(), ErpError> {
    match effect.expected_sign() {
        Some(expected) if (qty_delta * expected) < 0.0 => Err(ErpError::InventoryEffectMismatch(
            qty_delta,
            format!("{:?}", effect).to_lowercase(),
        )),
        _ => Ok(()),
    }
}
