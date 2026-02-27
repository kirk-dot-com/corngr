use std::collections::HashMap;

use crate::erp::types::{InvMove, Posting, TxHeader};

/// Org-level indexes maintained in-memory alongside the ErpStore.
/// In Phase A these are simple sorted Vecs.  Phase B: persisted as yrs YArrays.
#[derive(Debug, Default)]
pub struct OrgIndexes {
    /// All tx_ids in chronological order (newest last).
    pub tx_by_time: Vec<String>,
    /// tx_ids keyed by TxType string.
    pub tx_by_type: HashMap<String, Vec<String>>,
    /// tx_ids keyed by party_id.
    pub tx_by_party: HashMap<String, Vec<String>>,
    /// posting_ids keyed by account_id.
    pub postings_by_account: HashMap<String, Vec<String>>,
    /// move_ids keyed by item_id.
    pub inventory_moves_by_item: HashMap<String, Vec<String>>,
    /// approval_ids keyed by tx_id.
    pub approvals_by_tx: HashMap<String, Vec<String>>,
}

impl OrgIndexes {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update all indexes for a newly created/modified transaction.
    pub fn index_tx(&mut self, tx: &TxHeader, postings: &[Posting], invmoves: &[InvMove]) {
        let tx_id = &tx.tx_id;

        // tx_by_time (append, preserving insertion order)
        if !self.tx_by_time.contains(tx_id) {
            self.tx_by_time.push(tx_id.clone());
        }

        // tx_by_type
        self.tx_by_type
            .entry(tx.tx_type.as_str().to_string())
            .or_default()
            .push(tx_id.clone());

        // tx_by_party
        if let Some(party_id) = &tx.party_id {
            self.tx_by_party
                .entry(party_id.clone())
                .or_default()
                .push(tx_id.clone());
        }

        // postings_by_account
        for posting in postings {
            self.postings_by_account
                .entry(posting.account_id.clone())
                .or_default()
                .push(posting.posting_id.clone());
        }

        // inventory_moves_by_item
        for m in invmoves {
            self.inventory_moves_by_item
                .entry(m.item_id.clone())
                .or_default()
                .push(m.move_id.clone());
        }
    }

    /// Record an approval against a tx.
    pub fn index_approval(&mut self, tx_id: &str, approval_id: &str) {
        self.approvals_by_tx
            .entry(tx_id.to_string())
            .or_default()
            .push(approval_id.to_string());
    }
}

lazy_static::lazy_static! {
    pub static ref ORG_INDEXES: std::sync::Mutex<HashMap<String, OrgIndexes>> =
        std::sync::Mutex::new(HashMap::new());
}

/// Get-or-create the index for an org, then pass it to `f`.
pub fn with_org_indexes<F, R>(org_id: &str, f: F) -> R
where
    F: FnOnce(&mut OrgIndexes) -> R,
{
    let mut all = ORG_INDEXES.lock().unwrap();
    let idx = all
        .entry(org_id.to_string())
        .or_insert_with(OrgIndexes::new);
    f(idx)
}
