use serde::{Deserialize, Serialize};
use thiserror::Error;

/// All Phase A ERP error codes.
/// Maps to string codes used in EngineResult JSON payloads.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
pub enum ErpError {
    #[error("ERR_ABAC_DENY: {0}")]
    AbacDeny(String),

    #[error("ERR_INVALID_TX_TYPE: {0}")]
    InvalidTxType(String),

    #[error("ERR_INVALID_STATUS: cannot transition {0} → {1}")]
    InvalidStatus(String, String),

    #[error("ERR_INVALID_FIELD: {0}")]
    InvalidField(String),

    #[error("ERR_VALIDATION_FAIL: {0}")]
    ValidationFail(String),

    #[error("ERR_BALANCE_FAIL: debits={0:.4} credits={1:.4} delta={2:.4}")]
    BalanceFail(f64, f64, f64),

    #[error("ERR_APPROVAL_MISSING: tx {0} requires an approval atom of type '{1}'")]
    ApprovalMissing(String, String),

    #[error("ERR_ITEM_MISMATCH: invmove item {0} != txline item {1}")]
    ItemMismatch(String, String),

    #[error("ERR_INVENTORY_EFFECT_MISMATCH: qty_delta sign {0:+} incompatible with effect '{1}'")]
    InventoryEffectMismatch(f64, String),

    #[error("ERR_MOVE_QTY_EXCEEDS: moves sum {0:.4} exceeds line qty {1:.4}")]
    MoveQtyExceeds(f64, f64),

    #[error("ERR_SIG_INVALID: {0}")]
    SigInvalid(String),

    #[error("ERR_REPLAY_MUTATION_ID: duplicate mutation {0}")]
    ReplayMutationId(String),

    #[error("ERR_LAMPORT_REWIND: received {0} but max seen is {1}")]
    LamportRewind(u64, u64),

    #[error("ERR_POSTINGS_MISSING: tx {0} has no finalized postings")]
    PostingsMissing(String),

    #[error("ERR_LINE_IMMUTABLE: line {0} is on a posted tx and cannot be modified")]
    LineImmutable(String),
}

impl ErpError {
    /// Returns the canonical error code string (e.g. "ERR_ABAC_DENY")
    pub fn code(&self) -> &'static str {
        match self {
            ErpError::AbacDeny(_) => "ERR_ABAC_DENY",
            ErpError::InvalidTxType(_) => "ERR_INVALID_TX_TYPE",
            ErpError::InvalidStatus(_, _) => "ERR_INVALID_STATUS",
            ErpError::InvalidField(_) => "ERR_INVALID_FIELD",
            ErpError::ValidationFail(_) => "ERR_VALIDATION_FAIL",
            ErpError::BalanceFail(_, _, _) => "ERR_BALANCE_FAIL",
            ErpError::ApprovalMissing(_, _) => "ERR_APPROVAL_MISSING",
            ErpError::ItemMismatch(_, _) => "ERR_ITEM_MISMATCH",
            ErpError::InventoryEffectMismatch(_, _) => "ERR_INVENTORY_EFFECT_MISMATCH",
            ErpError::MoveQtyExceeds(_, _) => "ERR_MOVE_QTY_EXCEEDS",
            ErpError::SigInvalid(_) => "ERR_SIG_INVALID",
            ErpError::ReplayMutationId(_) => "ERR_REPLAY_MUTATION_ID",
            ErpError::LamportRewind(_, _) => "ERR_LAMPORT_REWIND",
            ErpError::PostingsMissing(_) => "ERR_POSTINGS_MISSING",
            ErpError::LineImmutable(_) => "ERR_LINE_IMMUTABLE",
        }
    }
}
