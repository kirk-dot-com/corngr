use crate::erp::errors::ErpError;
use crate::erp::types::{InventoryEffect, Posting, TxLine, TxType};

pub const ROUNDING_TOLERANCE: f64 = 0.01;

/// Generates balanced double-entry draft postings for a transaction.
/// The caller must supply lines and any linked inventory moves.
/// All postings are returned as drafts (status = "draft"); they are finalized at post_tx.
///
/// CoA account IDs used here are symbolic names expected to be resolved
/// against the org's Chart of Accounts at posting time (Phase B: full CoA lookup).
/// Phase A: use well-known logical account names — engine maps them via CoA templates.
pub fn generate_postings(
    tx_type: &TxType,
    tx_id: &str,
    lines: &[TxLine],
    _currency: &str,
    has_invmoves: bool,
) -> Result<Vec<Posting>, ErpError> {
    let mut postings: Vec<Posting> = Vec::new();

    // Line total (excl. tax), tax total
    let (line_total, tax_total) = line_totals(lines);
    let gross_total = line_total + tax_total;

    match tx_type {
        // ── invoice_out: DR Accounts Receivable / CR Revenue / CR Tax Payable ────
        // If invmoves present → also DR COGS / CR Inventory Asset
        TxType::InvoiceOut => {
            postings.push(draft_posting(
                tx_id,
                "accounts_receivable",
                gross_total,
                0.0,
                Some("AR - Invoice out"),
            ));
            postings.push(draft_posting(
                tx_id,
                "revenue",
                0.0,
                line_total,
                Some("Revenue - Invoice out"),
            ));
            if tax_total > 0.0 {
                postings.push(draft_posting(
                    tx_id,
                    "tax_payable",
                    0.0,
                    tax_total,
                    Some("GST/Tax payable"),
                ));
            }
            // COGS if shipped (invmoves present)
            if has_invmoves {
                let cogs = estimate_cogs(lines);
                if cogs > 0.0 {
                    postings.push(draft_posting(
                        tx_id,
                        "cogs",
                        cogs,
                        0.0,
                        Some("COGS - shipped"),
                    ));
                    postings.push(draft_posting(
                        tx_id,
                        "inventory_asset",
                        0.0,
                        cogs,
                        Some("Inventory relief - shipped"),
                    ));
                }
            }
        }

        // ── invoice_in: DR Expense or Inventory / CR Accounts Payable / CR Tax ──
        TxType::InvoiceIn => {
            let debit_account = if has_invmoves {
                "inventory_asset"
            } else {
                "expense"
            };
            postings.push(draft_posting(
                tx_id,
                debit_account,
                line_total,
                0.0,
                Some("Purchase - Invoice in"),
            ));
            if tax_total > 0.0 {
                postings.push(draft_posting(
                    tx_id,
                    "tax_receivable",
                    tax_total,
                    0.0,
                    Some("GST input tax credit"),
                ));
            }
            postings.push(draft_posting(
                tx_id,
                "accounts_payable",
                0.0,
                gross_total,
                Some("AP - Invoice in"),
            ));
        }

        // ── payment_in: DR Bank / CR Accounts Receivable ───────────────────────
        TxType::PaymentIn => {
            postings.push(draft_posting(
                tx_id,
                "bank",
                gross_total,
                0.0,
                Some("Payment received"),
            ));
            postings.push(draft_posting(
                tx_id,
                "accounts_receivable",
                0.0,
                gross_total,
                Some("AR settlement"),
            ));
        }

        // ── payment_out: DR Accounts Payable / CR Bank ─────────────────────────
        TxType::PaymentOut => {
            postings.push(draft_posting(
                tx_id,
                "accounts_payable",
                gross_total,
                0.0,
                Some("AP payment"),
            ));
            postings.push(draft_posting(
                tx_id,
                "bank",
                0.0,
                gross_total,
                Some("Bank payment"),
            ));
        }

        // ── stock_receipt: DR Inventory Asset / CR Accounts Payable or GRNI ────
        TxType::StockReceipt => {
            postings.push(draft_posting(
                tx_id,
                "inventory_asset",
                line_total,
                0.0,
                Some("Stock received"),
            ));
            postings.push(draft_posting(
                tx_id,
                "goods_received_not_invoiced",
                0.0,
                line_total,
                Some("GRNI"),
            ));
        }

        // ── stock_issue: DR COGS or Expense / CR Inventory Asset ───────────────
        TxType::StockIssue => {
            postings.push(draft_posting(
                tx_id,
                "cogs",
                line_total,
                0.0,
                Some("Stock issued"),
            ));
            postings.push(draft_posting(
                tx_id,
                "inventory_asset",
                0.0,
                line_total,
                Some("Inventory relief"),
            ));
        }

        // ── stock_adjust: DR/CR Inventory Asset + Adjustment account (signed) ──
        TxType::StockAdjust => {
            // line_total may be negative (write-down) or positive (write-up)
            if line_total >= 0.0 {
                postings.push(draft_posting(
                    tx_id,
                    "inventory_asset",
                    line_total,
                    0.0,
                    Some("Stock adjustment (increase)"),
                ));
                postings.push(draft_posting(
                    tx_id,
                    "stock_adjustment_gain",
                    0.0,
                    line_total,
                    Some("Adjustment gain"),
                ));
            } else {
                let abs = line_total.abs();
                postings.push(draft_posting(
                    tx_id,
                    "stock_adjustment_loss",
                    abs,
                    0.0,
                    Some("Adjustment loss"),
                ));
                postings.push(draft_posting(
                    tx_id,
                    "inventory_asset",
                    0.0,
                    abs,
                    Some("Stock adjustment (decrease)"),
                ));
            }
        }

        // ── journal: manual — lines carry explicit account + signed amount ──────
        TxType::Journal => {
            for line in lines {
                if let Some(acct) = &line.account_id {
                    let amount = (line.qty * line.unit_price).abs();
                    if line.unit_price >= 0.0 {
                        postings.push(draft_posting(
                            tx_id,
                            acct,
                            amount,
                            0.0,
                            line.description.as_deref(),
                        ));
                    } else {
                        postings.push(draft_posting(
                            tx_id,
                            acct,
                            0.0,
                            amount,
                            line.description.as_deref(),
                        ));
                    }
                }
            }
        }

        // ── credit_note: mirror of invoice_out with opposite directions ─────────
        TxType::CreditNote => {
            postings.push(draft_posting(
                tx_id,
                "accounts_receivable",
                0.0,
                gross_total,
                Some("AR credit"),
            ));
            postings.push(draft_posting(
                tx_id,
                "revenue",
                line_total,
                0.0,
                Some("Revenue reversal"),
            ));
            if tax_total > 0.0 {
                postings.push(draft_posting(
                    tx_id,
                    "tax_payable",
                    tax_total,
                    0.0,
                    Some("Tax return"),
                ));
            }
        }

        // ── debit_note: mirror of invoice_in with opposite directions ──────────
        TxType::DebitNote => {
            let debit_account = if has_invmoves {
                "inventory_asset"
            } else {
                "expense"
            };
            postings.push(draft_posting(
                tx_id,
                debit_account,
                0.0,
                line_total,
                Some("Debit note reversal"),
            ));
            postings.push(draft_posting(
                tx_id,
                "accounts_payable",
                gross_total,
                0.0,
                Some("AP debit note"),
            ));
        }
    }

    // Validate balance
    validate_balance(&postings)?;

    Ok(postings)
}

/// Validates that a set of postings is balanced within ROUNDING_TOLERANCE.
pub fn validate_balance(postings: &[Posting]) -> Result<(), ErpError> {
    let total_debit: f64 = postings.iter().map(|p| p.debit_amount).sum();
    let total_credit: f64 = postings.iter().map(|p| p.credit_amount).sum();
    let delta = (total_debit - total_credit).abs();
    if delta > ROUNDING_TOLERANCE {
        return Err(ErpError::BalanceFail(total_debit, total_credit, delta));
    }
    Ok(())
}

// ─── helpers ────────────────────────────────────────────────────────────────

fn draft_posting(
    tx_id: &str,
    account_id: &str,
    debit: f64,
    credit: f64,
    desc: Option<&str>,
) -> Posting {
    use crate::erp::fragments;
    let pid = uuid::Uuid::new_v4().to_string();
    Posting {
        posting_id: fragments::posting_id(&pid),
        tx_id: tx_id.to_string(),
        account_id: account_id.to_string(),
        debit_amount: round2(debit),
        credit_amount: round2(credit),
        currency: "AUD".to_string(), // Phase A default; comes from tx header
        description: desc.map(str::to_string),
        status: "draft".to_string(),
        generated_by: "engine".to_string(),
    }
}

fn line_totals(lines: &[TxLine]) -> (f64, f64) {
    let mut line_total = 0.0_f64;
    let mut tax_total = 0.0_f64;
    for line in lines {
        let subtotal = line.qty * line.unit_price;
        line_total += subtotal;
        tax_total += subtotal * line.tax_rate;
    }
    (round2(line_total), round2(tax_total))
}

fn estimate_cogs(lines: &[TxLine]) -> f64 {
    // Phase A: COGS = invoiced amount for shipped lines (no weighted-avg valuation yet)
    // Phase B: replace with actual valuation engine
    let total: f64 = lines
        .iter()
        .filter(|l| matches!(l.inventory_effect, InventoryEffect::Decrease))
        .map(|l| l.qty * l.unit_price)
        .sum();
    round2(total)
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::erp::types::{InventoryEffect, TxLine};

    fn sample_line(
        qty: f64,
        unit_price: f64,
        tax_rate: f64,
        inv_effect: InventoryEffect,
    ) -> TxLine {
        TxLine {
            line_id: "line1".to_string(),
            tx_id: "tx1".to_string(),
            item_id: Some("item1".to_string()),
            account_id: Some("revenue".to_string()),
            description: None,
            qty,
            unit_price,
            inventory_effect: inv_effect,
            move_ids: vec![],
            tax_code: Some("GST".to_string()),
            tax_rate,
        }
    }

    #[test]
    fn test_posting_template_invoice_out() {
        let lines = vec![sample_line(10.0, 100.0, 0.1, InventoryEffect::None)];
        let postings = generate_postings(&TxType::InvoiceOut, "tx1", &lines, "AUD", false)
            .expect("generate_postings should succeed");

        // Should have AR debit + Revenue credit + Tax credit
        let ar = postings
            .iter()
            .find(|p| p.account_id == "accounts_receivable")
            .expect("AR posting");
        assert_eq!(ar.debit_amount, 1100.0, "AR debit should be gross total");
        assert_eq!(ar.credit_amount, 0.0);

        let rev = postings
            .iter()
            .find(|p| p.account_id == "revenue")
            .expect("Revenue posting");
        assert_eq!(rev.credit_amount, 1000.0);
        assert_eq!(rev.debit_amount, 0.0);

        let tax = postings
            .iter()
            .find(|p| p.account_id == "tax_payable")
            .expect("Tax posting");
        assert_eq!(tax.credit_amount, 100.0);

        // Must balance
        let total_dr: f64 = postings.iter().map(|p| p.debit_amount).sum();
        let total_cr: f64 = postings.iter().map(|p| p.credit_amount).sum();
        assert!(
            (total_dr - total_cr).abs() <= ROUNDING_TOLERANCE,
            "Postings must balance: dr={total_dr} cr={total_cr}"
        );
    }

    #[test]
    fn test_tx_post_balance_invariant() {
        // Manually create imbalanced postings — validate_balance must reject
        let bad_postings = vec![
            Posting {
                posting_id: "p1".to_string(),
                tx_id: "tx1".to_string(),
                account_id: "bank".to_string(),
                debit_amount: 100.0,
                credit_amount: 0.0,
                currency: "AUD".to_string(),
                description: None,
                status: "draft".to_string(),
                generated_by: "engine".to_string(),
            },
            Posting {
                posting_id: "p2".to_string(),
                tx_id: "tx1".to_string(),
                account_id: "revenue".to_string(),
                debit_amount: 0.0,
                credit_amount: 80.0, // intentionally wrong
                currency: "AUD".to_string(),
                description: None,
                status: "draft".to_string(),
                generated_by: "engine".to_string(),
            },
        ];
        assert_eq!(
            validate_balance(&bad_postings),
            Err(ErpError::BalanceFail(100.0, 80.0, 20.0))
        );
    }
}
