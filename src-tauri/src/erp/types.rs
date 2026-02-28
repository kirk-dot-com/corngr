use crate::erp::errors::ErpError;
use serde::{Deserialize, Serialize};

/// Transaction types supported in Phase A.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TxType {
    InvoiceOut,
    InvoiceIn,
    PaymentIn,
    PaymentOut,
    StockReceipt,
    StockIssue,
    StockAdjust,
    Journal,
    CreditNote,
    DebitNote,
}

impl TxType {
    pub fn from_str(s: &str) -> Result<Self, ErpError> {
        match s {
            "invoice_out" => Ok(TxType::InvoiceOut),
            "invoice_in" => Ok(TxType::InvoiceIn),
            "payment_in" => Ok(TxType::PaymentIn),
            "payment_out" => Ok(TxType::PaymentOut),
            "stock_receipt" => Ok(TxType::StockReceipt),
            "stock_issue" => Ok(TxType::StockIssue),
            "stock_adjust" => Ok(TxType::StockAdjust),
            "journal" => Ok(TxType::Journal),
            "credit_note" => Ok(TxType::CreditNote),
            "debit_note" => Ok(TxType::DebitNote),
            other => Err(ErpError::InvalidTxType(other.to_string())),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            TxType::InvoiceOut => "invoice_out",
            TxType::InvoiceIn => "invoice_in",
            TxType::PaymentIn => "payment_in",
            TxType::PaymentOut => "payment_out",
            TxType::StockReceipt => "stock_receipt",
            TxType::StockIssue => "stock_issue",
            TxType::StockAdjust => "stock_adjust",
            TxType::Journal => "journal",
            TxType::CreditNote => "credit_note",
            TxType::DebitNote => "debit_note",
        }
    }
}

/// Lifecycle status of a transaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TxStatus {
    Draft,
    Proposed,
    Approved,
    Posted,
    Void,
}

impl TxStatus {
    pub fn from_str(s: &str) -> Result<Self, ErpError> {
        match s {
            "draft" => Ok(TxStatus::Draft),
            "proposed" => Ok(TxStatus::Proposed),
            "approved" => Ok(TxStatus::Approved),
            "posted" => Ok(TxStatus::Posted),
            "void" => Ok(TxStatus::Void),
            other => Err(ErpError::InvalidField(format!("unknown status: {}", other))),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            TxStatus::Draft => "draft",
            TxStatus::Proposed => "proposed",
            TxStatus::Approved => "approved",
            TxStatus::Posted => "posted",
            TxStatus::Void => "void",
        }
    }
}

/// ERP roles for Phase A ABAC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    OwnerAdmin,
    Manager,
    Finance,
    Staff,
    Auditor,
    /// Internal engine identity — used for index updates that are engine-only.
    Engine,
}

impl Role {
    pub fn from_str(s: &str) -> Result<Self, ErpError> {
        match s {
            "owner_admin" => Ok(Role::OwnerAdmin),
            "manager" => Ok(Role::Manager),
            "finance" => Ok(Role::Finance),
            "staff" => Ok(Role::Staff),
            "auditor" => Ok(Role::Auditor),
            "engine" => Ok(Role::Engine),
            other => Err(ErpError::InvalidField(format!("unknown role: {}", other))),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Role::OwnerAdmin => "owner_admin",
            Role::Manager => "manager",
            Role::Finance => "finance",
            Role::Staff => "staff",
            Role::Auditor => "auditor",
            Role::Engine => "engine",
        }
    }
}

/// Inventory effect direction for txline/invmove.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InventoryEffect {
    Increase,
    Decrease,
    None,
}

impl InventoryEffect {
    pub fn from_str(s: &str) -> Self {
        match s {
            "increase" => InventoryEffect::Increase,
            "decrease" => InventoryEffect::Decrease,
            _ => InventoryEffect::None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            InventoryEffect::Increase => "increase",
            InventoryEffect::Decrease => "decrease",
            InventoryEffect::None => "none",
        }
    }

    /// Returns the expected sign for qty_delta given this effect.
    /// increase → positive (+), decrease → negative (-)
    pub fn expected_sign(&self) -> Option<f64> {
        match self {
            InventoryEffect::Increase => Some(1.0),
            InventoryEffect::Decrease => Some(-1.0),
            InventoryEffect::None => None,
        }
    }
}

/// Actor context passed into every engine call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActorContext {
    /// Hex-encoded Ed25519 public key (the actor's identity).
    pub pubkey: String,
    pub role: Role,
    pub org_id: String,
    /// Lamport clock — caller must track and increment per envelope.
    pub lamport: u64,
}

/// Context describing the resource being acted on.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyContext {
    pub org_id: String,
    pub tx_id: Option<String>,
    pub tx_status: Option<TxStatus>,
}

/// Reference returned after a successful transaction creation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxRef {
    pub tx_id: String,
    pub org_id: String,
    pub status: TxStatus,
}

/// Transaction header — stored in fragment `tx:{id}:hdr`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxHeader {
    pub tx_id: String,
    pub org_id: String,
    pub tx_type: TxType,
    pub status: TxStatus,
    pub party_id: Option<String>,
    pub currency: String,
    pub ref_number: Option<String>,
    pub description: Option<String>,
    pub tx_date: String,
    pub created_at_ms: i64,
    pub created_by_pubkey: String,
    /// ADR-0001 §5 — optional site identifier, defaults to "primary"
    pub site_id: String,
}

/// A single business line on a transaction — stored in fragment `txline:{id}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxLine {
    pub line_id: String,
    pub tx_id: String,
    pub item_id: Option<String>,
    pub account_id: Option<String>,
    pub description: Option<String>,
    pub qty: f64,
    pub unit_price: f64,
    /// "increase" | "decrease" | "none"
    pub inventory_effect: InventoryEffect,
    /// IDs of linked InvMove fragments
    pub move_ids: Vec<String>,
    pub tax_code: Option<String>,
    pub tax_rate: f64,
}

/// An inventory movement — stored in fragment `invmove:{id}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvMove {
    pub move_id: String,
    pub tx_id: String,
    pub tx_line_id: String,
    pub item_id: String,
    /// Positive = into stock (receipt), negative = out of stock (issue)
    pub qty_delta: f64,
    pub location_id: Option<String>,
    pub moved_at_ms: i64,
    pub moved_by_pubkey: String,
    /// ADR-0001 §5 — optional site identifier, defaults to "primary"
    pub site_id: String,
}

/// A double-entry posting — stored in fragment `posting:{id}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Posting {
    pub posting_id: String,
    pub tx_id: String,
    pub account_id: String,
    pub debit_amount: f64,
    pub credit_amount: f64,
    pub currency: String,
    pub description: Option<String>,
    /// "draft" → engine-generated draft | "final" → committed at post_tx
    pub status: String,
    pub generated_by: String, // "engine" always in Phase A
}

/// An approval atom — stored in fragment `approval:{id}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalAtom {
    pub approval_id: String,
    pub tx_id: String,
    /// "post" | "reverse" | "propose"
    pub approval_type: String,
    pub signer_pubkey: String,
    pub signed_at_ms: i64,
    /// Hex-encoded Ed25519 signature over tx_id + approval_type + signed_at_ms
    pub signature_ref: String,
}

/// Kind of CRDT operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Op {
    MapSet {
        fragment_id: String,
        key: String,
        value: serde_json::Value,
    },
    MapDel {
        fragment_id: String,
        key: String,
    },
    ArrayInsert {
        fragment_id: String,
        index: u32,
        values: Vec<serde_json::Value>,
    },
    ArrayDelete {
        fragment_id: String,
        index: u32,
        len: u32,
    },
    LinkAdd {
        from_fragment: String,
        to_fragment: String,
        rel_type: String,
    },
    ProposalCreate {
        proposal_id: String,
        source_fragment: String,
        ops: Vec<Box<Op>>,
        rationale: String,
    },
}

/// Request payload for create_tx.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTxRequest {
    pub tx_type: String,
    pub org_id: String,
    pub party_id: Option<String>,
    pub currency: String,
    pub ref_number: Option<String>,
    pub description: Option<String>,
    pub tx_date: String,
    /// ADR-0001 §5: defaults to "primary" if absent
    pub site_id: Option<String>,
}

/// Request payload for add_line.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddLineRequest {
    pub tx_id: String,
    pub item_id: Option<String>,
    pub account_id: Option<String>,
    pub description: Option<String>,
    pub qty: f64,
    pub unit_price: f64,
    pub inventory_effect: String,
    pub tax_code: Option<String>,
    pub tax_rate: Option<f64>,
}

/// Request payload for create_invmove.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvMoveRequest {
    pub tx_id: String,
    pub tx_line_id: String,
    pub item_id: String,
    pub qty_delta: f64,
    pub location_id: Option<String>,
    /// ADR-0001 §5: defaults to "primary" if absent
    pub site_id: Option<String>,
}

// ─── M9: Party Master ────────────────────────────────────────────────────────

/// Classification of a party (customer, supplier, employee, other).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PartyKind {
    Customer,
    Supplier,
    Employee,
    Other,
}

impl PartyKind {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "customer" => PartyKind::Customer,
            "supplier" => PartyKind::Supplier,
            "employee" => PartyKind::Employee,
            _ => PartyKind::Other,
        }
    }
    pub fn as_str(&self) -> &'static str {
        match self {
            PartyKind::Customer => "customer",
            PartyKind::Supplier => "supplier",
            PartyKind::Employee => "employee",
            PartyKind::Other => "other",
        }
    }
}

/// A party (customer / supplier / employee) — stored in fragment `party:{party_id}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Party {
    pub party_id: String,
    pub org_id: String,
    pub name: String,
    pub kind: PartyKind,
    pub email: Option<String>,
    pub contact: Option<String>,
    /// Australian Business Number — Phase A AU locale field
    pub abn: Option<String>,
    pub created_at_ms: i64,
}

/// Request payload for erp_create_party.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePartyRequest {
    pub org_id: String,
    pub name: String,
    pub kind: String, // "customer" | "supplier" | "employee" | "other"
    pub email: Option<String>,
    pub contact: Option<String>,
    pub abn: Option<String>,
}
