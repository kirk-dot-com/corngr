use crate::erp::abac::{check_abac, Action};
use crate::erp::errors::ErpError;
use crate::erp::ledger::{validate_balance, ROUNDING_TOLERANCE};
use crate::erp::types::{
    ActorContext, ApprovalAtom, InvMove, InventoryEffect, PolicyContext, Posting, TxHeader, TxLine,
    TxStatus, TxType,
};

/// Validates that a transaction can be posted and transitions it to `posted`.
/// Enforces all invariants from IMPLEMENTATION_PLAN §1.4 + ADR-0001 §4.
pub fn validate_post(
    actor: &ActorContext,
    tx_header: &TxHeader,
    lines: &[TxLine],
    invmoves: &[InvMove],
    postings: &[Posting],
    approvals: &[ApprovalAtom],
) -> Result<(), ErpError> {
    let tx_id = &tx_header.tx_id;
    let tx_type = &tx_header.tx_type;

    // 1. ABAC: tx.post requires finance / owner_admin
    let ctx = PolicyContext {
        org_id: tx_header.org_id.clone(),
        tx_id: Some(tx_id.clone()),
        tx_status: Some(tx_header.status.clone()),
    };
    check_abac(actor, &Action::TxPost, &ctx)?;

    // 2. Status must be `approved` to transition to `posted`
    if tx_header.status != TxStatus::Approved {
        return Err(ErpError::InvalidStatus(
            tx_header.status.as_str().to_string(),
            "posted".to_string(),
        ));
    }

    // 3. Approval atom required (type "post")
    let has_post_approval = approvals
        .iter()
        .any(|a| a.tx_id == *tx_id && a.approval_type == "post" && !a.signature_ref.is_empty());
    if !has_post_approval {
        return Err(ErpError::ApprovalMissing(tx_id.clone(), "post".to_string()));
    }

    // 4. Partial fulfillment validation (ADR-0001 §4)
    match tx_type {
        TxType::InvoiceOut | TxType::StockReceipt => {
            // At least one linked invmove must exist
            let linked: Vec<&InvMove> = invmoves.iter().filter(|m| m.tx_id == *tx_id).collect();
            if linked.is_empty() {
                return Err(ErpError::ValidationFail(format!(
                    "post_tx: {} requires at least one linked inventory move",
                    tx_type.as_str()
                )));
            }

            // For each line, validate qty invariants
            for line in lines {
                let line_moves: Vec<&&InvMove> = linked
                    .iter()
                    .filter(|m| m.tx_line_id == line.line_id)
                    .collect();

                let move_sum: f64 = line_moves.iter().map(|m| m.qty_delta.abs()).sum();

                // Hard invariant: sum(|moves.qty_delta|) ≤ line.qty (unless overship enabled — not in Phase A)
                if move_sum > line.qty + ROUNDING_TOLERANCE {
                    return Err(ErpError::MoveQtyExceeds(move_sum, line.qty));
                }

                // inventory_effect direction must match qty_delta sign
                for m in &line_moves {
                    validate_invmove_direction(m, &line.inventory_effect)?;
                }
            }
        }
        _ => {
            // Non-inventory tx types: validate invmove directions if moves exist
            for m in invmoves.iter().filter(|m| m.tx_id == *tx_id) {
                // Find parent line
                if let Some(line) = lines.iter().find(|l| l.line_id == m.tx_line_id) {
                    validate_invmove_direction(m, &line.inventory_effect)?;
                    // item_id must match
                    if let Some(ref line_item) = line.item_id {
                        if m.item_id != *line_item {
                            return Err(ErpError::ItemMismatch(
                                m.item_id.clone(),
                                line_item.clone(),
                            ));
                        }
                    }
                }
            }
        }
    }

    // 5. Postings must exist and be balanced
    let tx_postings: Vec<&Posting> = postings.iter().filter(|p| p.tx_id == *tx_id).collect();
    if tx_postings.is_empty() {
        return Err(ErpError::PostingsMissing(tx_id.clone()));
    }
    let owned: Vec<Posting> = tx_postings.iter().map(|p| (*p).clone()).collect();
    validate_balance(&owned)?;

    // 6. Line immutability check — all lines on a posted tx become immutable
    // (enforced here by checking that status transition is valid; actual immutability
    // is re-checked on any subsequent edit attempt via ABAC)

    Ok(())
}

/// Validates that an inventory move's qty_delta sign matches the expected direction.
fn validate_invmove_direction(m: &InvMove, effect: &InventoryEffect) -> Result<(), ErpError> {
    match effect.expected_sign() {
        Some(expected) if (m.qty_delta * expected) < 0.0 => Err(ErpError::InventoryEffectMismatch(
            m.qty_delta,
            format!("{:?}", effect).to_lowercase(),
        )),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::erp::types::{InventoryEffect, Role};

    fn finance_actor(org_id: &str) -> ActorContext {
        ActorContext {
            pubkey: "pubkey_finance".to_string(),
            role: Role::Finance,
            org_id: org_id.to_string(),
            lamport: 1,
        }
    }

    fn approved_tx(org_id: &str, tx_type: TxType) -> TxHeader {
        TxHeader {
            tx_id: "tx1".to_string(),
            org_id: org_id.to_string(),
            tx_type,
            status: TxStatus::Approved,
            party_id: None,
            currency: "AUD".to_string(),
            ref_number: None,
            description: None,
            tx_date: "2026-02-28".to_string(),
            created_at_ms: 0,
            created_by_pubkey: "pk1".to_string(),
            site_id: "primary".to_string(),
        }
    }

    fn sample_line(qty: f64, effect: InventoryEffect) -> TxLine {
        TxLine {
            line_id: "line1".to_string(),
            tx_id: "tx1".to_string(),
            item_id: Some("item1".to_string()),
            account_id: None,
            description: None,
            qty,
            unit_price: 10.0,
            inventory_effect: effect,
            move_ids: vec![],
            tax_code: None,
            tax_rate: 0.0,
        }
    }

    fn sample_approval(tx_id: &str) -> ApprovalAtom {
        ApprovalAtom {
            approval_id: "appr1".to_string(),
            tx_id: tx_id.to_string(),
            approval_type: "post".to_string(),
            signer_pubkey: "pk1".to_string(),
            signed_at_ms: 1000,
            signature_ref: "sig_hex_here".to_string(),
        }
    }

    fn balanced_posting(tx_id: &str) -> Vec<Posting> {
        vec![
            Posting {
                posting_id: "p1".to_string(),
                tx_id: tx_id.to_string(),
                account_id: "accounts_receivable".to_string(),
                debit_amount: 100.0,
                credit_amount: 0.0,
                currency: "AUD".to_string(),
                description: None,
                status: "draft".to_string(),
                generated_by: "engine".to_string(),
            },
            Posting {
                posting_id: "p2".to_string(),
                tx_id: tx_id.to_string(),
                account_id: "revenue".to_string(),
                debit_amount: 0.0,
                credit_amount: 100.0,
                currency: "AUD".to_string(),
                description: None,
                status: "draft".to_string(),
                generated_by: "engine".to_string(),
            },
        ]
    }

    #[test]
    fn test_post_requires_approval() {
        let tx = approved_tx("org1", TxType::Journal);
        let lines: Vec<TxLine> = vec![];
        let invmoves: Vec<InvMove> = vec![];
        let postings = balanced_posting("tx1");
        let approvals: Vec<ApprovalAtom> = vec![]; // no approval!

        let result = validate_post(
            &finance_actor("org1"),
            &tx,
            &lines,
            &invmoves,
            &postings,
            &approvals,
        );
        assert_eq!(
            result,
            Err(ErpError::ApprovalMissing("tx1".into(), "post".into()))
        );
    }

    #[test]
    fn test_invmove_qty_sign() {
        // StockReceipt expects a positive qty_delta (increase)
        let tx = approved_tx("org1", TxType::StockReceipt);
        let lines = vec![sample_line(10.0, InventoryEffect::Increase)];
        let invmoves = vec![InvMove {
            move_id: "m1".to_string(),
            tx_id: "tx1".to_string(),
            tx_line_id: "line1".to_string(),
            item_id: "item1".to_string(),
            qty_delta: -5.0, // WRONG sign for stock_receipt
            location_id: None,
            moved_at_ms: 0,
            moved_by_pubkey: "pk1".to_string(),
            site_id: "primary".to_string(),
        }];
        let postings = balanced_posting("tx1");
        let approvals = vec![sample_approval("tx1")];

        let result = validate_post(
            &finance_actor("org1"),
            &tx,
            &lines,
            &invmoves,
            &postings,
            &approvals,
        );
        assert_eq!(
            result,
            Err(ErpError::InventoryEffectMismatch(
                -5.0,
                "increase".to_string()
            ))
        );
    }

    #[test]
    fn test_partial_fulfillment_allowed() {
        // invoice_out: partial shipment (5 of 10 qty) should be allowed
        let tx = approved_tx("org1", TxType::InvoiceOut);
        let lines = vec![sample_line(10.0, InventoryEffect::Decrease)];
        let invmoves = vec![InvMove {
            move_id: "m1".to_string(),
            tx_id: "tx1".to_string(),
            tx_line_id: "line1".to_string(),
            item_id: "item1".to_string(),
            qty_delta: -5.0, // partial: only 5 of 10 shipped
            location_id: None,
            moved_at_ms: 0,
            moved_by_pubkey: "pk1".to_string(),
            site_id: "primary".to_string(),
        }];
        let postings = balanced_posting("tx1");
        let approvals = vec![sample_approval("tx1")];

        let result = validate_post(
            &finance_actor("org1"),
            &tx,
            &lines,
            &invmoves,
            &postings,
            &approvals,
        );
        assert!(
            result.is_ok(),
            "partial fulfillment should be allowed: {:?}",
            result
        );
    }

    #[test]
    fn test_move_qty_exceeds_line() {
        // Overship: moves sum > line qty → ERR_MOVE_QTY_EXCEEDS
        let tx = approved_tx("org1", TxType::InvoiceOut);
        let lines = vec![sample_line(5.0, InventoryEffect::Decrease)];
        let invmoves = vec![InvMove {
            move_id: "m1".to_string(),
            tx_id: "tx1".to_string(),
            tx_line_id: "line1".to_string(),
            item_id: "item1".to_string(),
            qty_delta: -10.0, // exceeds 5.0 line qty
            location_id: None,
            moved_at_ms: 0,
            moved_by_pubkey: "pk1".to_string(),
            site_id: "primary".to_string(),
        }];
        let postings = balanced_posting("tx1");
        let approvals = vec![sample_approval("tx1")];

        let result = validate_post(
            &finance_actor("org1"),
            &tx,
            &lines,
            &invmoves,
            &postings,
            &approvals,
        );
        assert_eq!(result, Err(ErpError::MoveQtyExceeds(10.0, 5.0)));
    }
}
