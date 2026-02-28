use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use uuid::Uuid;

use crate::erp::abac::{check_abac, Action};
use crate::erp::audit_log;
use crate::erp::db;
use crate::erp::envelope::MutationEnvelope;
use crate::erp::errors::ErpError;
use crate::erp::fragments;
use crate::erp::replay::ReplayGuard;
use crate::erp::types::{
    ActorContext, AddLineRequest, CreateInvMoveRequest, CreateTxRequest, InvMove, InventoryEffect,
    Op, Party, PolicyContext, Posting, TxHeader, TxLine, TxRef, TxStatus, TxType,
};

/// A Chart of Accounts record — stored in ErpStore::accounts keyed by account code.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AccountRecord {
    pub code: String,
    pub name: String,
    pub acct_type: String, // "asset" | "liability" | "equity" | "income" | "expense"
    pub normal_balance: String, // "debit" | "credit"
}

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
    /// Chart of Accounts — keyed by account code ("1000", "2000", …)
    pub accounts: std::collections::HashMap<String, AccountRecord>,
    /// Committed postings — keyed by posting_id; populated on erp_post_tx success
    pub postings: std::collections::HashMap<String, Posting>,
    /// Party master — keyed by party_id (M9)
    pub parties: std::collections::HashMap<String, Party>,
}

impl ErpStore {
    pub fn new() -> Self {
        Self {
            transactions: Default::default(),
            lines: Default::default(),
            invmoves: Default::default(),
            replay: ReplayGuard::new(),
            actor_prev_hash: Default::default(),
            accounts: Default::default(),
            postings: Default::default(),
            parties: Default::default(),
        }
    }
}

/// Apply a slice of CoA template ops into the given accounts HashMap.
/// Processes MapSet {key=code/name/type/normal_balance} on account:{code} fragments.
pub fn seed_coa_ops(ops: &[Op], accounts: &mut std::collections::HashMap<String, AccountRecord>) {
    use std::collections::HashMap;
    // Group ops by fragment_id
    let mut groups: HashMap<String, HashMap<String, String>> = HashMap::new();
    for op in ops {
        if let Op::MapSet {
            fragment_id,
            key,
            value,
        } = op
        {
            if fragment_id.starts_with("account:") {
                let entry = groups.entry(fragment_id.clone()).or_default();
                entry.insert(key.clone(), value.as_str().unwrap_or("").to_string());
            }
        }
    }
    for (_, fields) in groups {
        let code = fields.get("code").cloned().unwrap_or_default();
        if code.is_empty() {
            continue;
        }
        accounts.insert(
            code.clone(),
            AccountRecord {
                code,
                name: fields
                    .get("name")
                    .cloned()
                    .unwrap_or_else(|| "(unnamed)".to_string()),
                acct_type: fields
                    .get("type")
                    .cloned()
                    .unwrap_or_else(|| "asset".to_string()),
                normal_balance: fields
                    .get("normal_balance")
                    .cloned()
                    .unwrap_or_else(|| "debit".to_string()),
            },
        );
    }
}

lazy_static::lazy_static! {
    /// In-memory working set — populated from SQLite at first access via `erp::db::load_all()`
    /// when the app-data path becomes available (set by lib.rs setup via `init_erp_db`).
    pub static ref ERP_STORE: Mutex<ErpStore> = Mutex::new(ErpStore::new());

    /// SQLite connection — `None` until `init_erp_db` is called from lib.rs setup.
    /// All DB writes are best-effort: log errors but never fail the mutation.
    pub static ref ERP_DB: Mutex<Option<Connection>> = Mutex::new(None);
}

/// Called from lib.rs `.setup()` once the app-data directory is known.
/// Opens (creates) `corngr.db`, loads all rows into ERP_STORE, and stores the
/// connection in ERP_DB for subsequent write-through upserts.
pub fn init_erp_db(db_path: &std::path::Path) {
    match db::init_db(db_path) {
        Ok(conn) => {
            // Warm the in-memory store from persisted data
            match db::load_all(&conn) {
                Ok(loaded) => {
                    let mut store = ERP_STORE.lock().unwrap();
                    *store = loaded;
                    println!("✅ ERP store loaded from SQLite: {:?}", db_path);
                }
                Err(e) => eprintln!("⚠️  ERP load_all failed: {e}"),
            }
            *ERP_DB.lock().unwrap() = Some(conn);
        }
        Err(e) => eprintln!("⚠️  ERP DB init failed: {e}"),
    }
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

    // 6. Store (in-memory + SQLite write-through)
    let header_for_db = header.clone();
    store.transactions.insert(tx_id.clone(), header);

    // 7. Audit log + SQLite persist (both best-effort)
    drop(store);
    let _ = audit_log::append(&envelope);
    if let Ok(db_guard) = ERP_DB.lock() {
        if let Some(ref conn) = *db_guard {
            if let Err(e) = db::upsert_tx(conn, &header_for_db) {
                eprintln!("⚠️  ERP DB upsert_tx failed: {e}");
            }
        }
    }

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
    let inv_effect = InventoryEffect::from_str(&req.inventory_effect);

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
    let line_for_db = line.clone();
    store.lines.insert(line_id.clone(), line);

    drop(store);
    let _ = audit_log::append(&envelope);
    if let Ok(db_guard) = ERP_DB.lock() {
        if let Some(ref conn) = *db_guard {
            if let Err(e) = db::upsert_line(conn, &line_for_db) {
                eprintln!("⚠️  ERP DB upsert_line failed: {e}");
            }
        }
    }

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
    let invmove_for_db = invmove.clone();
    store.invmoves.insert(move_id.clone(), invmove);

    // Update line's move_ids
    if let Some(l) = store.lines.get_mut(&req.tx_line_id) {
        l.move_ids.push(move_id.clone());
    }

    drop(store);
    let _ = audit_log::append(&envelope);
    if let Ok(db_guard) = ERP_DB.lock() {
        if let Some(ref conn) = *db_guard {
            if let Err(e) = db::upsert_invmove(conn, &invmove_for_db) {
                eprintln!("⚠️  ERP DB upsert_invmove failed: {e}");
            }
        }
    }

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
