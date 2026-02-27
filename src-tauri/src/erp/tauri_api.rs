use serde::{Deserialize, Serialize};

use crate::erp::audit_log;
use crate::erp::engine;
use crate::erp::engine::ERP_STORE;
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
            // Transition to posted
            let mut store = ERP_STORE.lock().unwrap();
            if let Some(t) = store.transactions.get_mut(&tx_id) {
                t.status = crate::erp::types::TxStatus::Posted;
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

/// Get a transaction snapshot (header + lines + invmoves + postings count).
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
