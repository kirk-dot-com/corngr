use crate::erp::types::Op;

/// Seed Chart of Accounts templates (ADR-0001 §1).
/// Each template returns a Vec<Op> that creates the account fragments
/// when applied against the org's yrs doc (Phase A: stored as fragment map ops).
///
/// Account structure per fragment: `account:{id}` → MapSet { code, name, type, normal_balance }

pub fn general_sme_au_gst() -> Vec<Op> {
    seed_accounts(vec![
        ("1000", "Cash & Bank", "asset", "debit"),
        ("1100", "Accounts Receivable", "asset", "debit"),
        ("1200", "GST Input Tax Credit", "asset", "debit"),
        ("1300", "Inventory Asset", "asset", "debit"),
        ("2000", "Accounts Payable", "liability", "credit"),
        ("2100", "GST Tax Payable", "liability", "credit"),
        ("2200", "PAYG Withholding Payable", "liability", "credit"),
        ("2300", "Goods Received Not Invoiced", "liability", "credit"),
        ("3000", "Owner's Equity", "equity", "credit"),
        ("4000", "Revenue", "income", "credit"),
        ("5000", "Cost of Goods Sold", "expense", "debit"),
        ("5100", "Wages & Salaries", "expense", "debit"),
        ("5200", "Rent", "expense", "debit"),
        ("5300", "Utilities", "expense", "debit"),
        ("5400", "Stock Adjustment Gain", "income", "credit"),
        ("5401", "Stock Adjustment Loss", "expense", "debit"),
        ("5900", "General Expense", "expense", "debit"),
    ])
}

pub fn services_low_inventory() -> Vec<Op> {
    seed_accounts(vec![
        ("1000", "Cash & Bank", "asset", "debit"),
        ("1100", "Accounts Receivable", "asset", "debit"),
        ("1200", "GST Input Tax Credit", "asset", "debit"),
        ("2000", "Accounts Payable", "liability", "credit"),
        ("2100", "GST Tax Payable", "liability", "credit"),
        ("3000", "Owner's Equity", "equity", "credit"),
        ("4000", "Service Revenue", "income", "credit"),
        ("4100", "Consulting Revenue", "income", "credit"),
        ("5000", "Cost of Services", "expense", "debit"),
        ("5100", "Wages & Salaries", "expense", "debit"),
        ("5200", "Subcontractors", "expense", "debit"),
        ("5300", "Software & Tools", "expense", "debit"),
        ("5900", "General Expense", "expense", "debit"),
    ])
}

pub fn product_manufacturing() -> Vec<Op> {
    seed_accounts(vec![
        ("1000", "Cash & Bank", "asset", "debit"),
        ("1100", "Accounts Receivable", "asset", "debit"),
        ("1200", "GST Input Tax Credit", "asset", "debit"),
        ("1300", "Raw Materials Inventory", "asset", "debit"),
        ("1310", "Work in Progress", "asset", "debit"),
        ("1320", "Finished Goods", "asset", "debit"),
        ("2000", "Accounts Payable", "liability", "credit"),
        ("2100", "GST Tax Payable", "liability", "credit"),
        ("2200", "PAYG Withholding Payable", "liability", "credit"),
        ("2300", "Goods Received Not Invoiced", "liability", "credit"),
        ("3000", "Owner's Equity", "equity", "credit"),
        ("4000", "Product Revenue", "income", "credit"),
        ("5000", "Direct Materials (COGS)", "expense", "debit"),
        ("5100", "Direct Labour (COGS)", "expense", "debit"),
        ("5200", "Manufacturing Overhead", "expense", "debit"),
        ("5300", "Wages & Salaries", "expense", "debit"),
        ("5400", "Stock Adjustment Gain", "income", "credit"),
        ("5401", "Stock Adjustment Loss", "expense", "debit"),
        ("5900", "General Expense", "expense", "debit"),
    ])
}

pub enum CoATemplate {
    GeneralSmeAuGst,
    ServicesLowInventory,
    ProductManufacturing,
}

pub fn get_template(template: &CoATemplate) -> Vec<Op> {
    match template {
        CoATemplate::GeneralSmeAuGst => general_sme_au_gst(),
        CoATemplate::ServicesLowInventory => services_low_inventory(),
        CoATemplate::ProductManufacturing => product_manufacturing(),
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────

fn seed_accounts(accounts: Vec<(&str, &str, &str, &str)>) -> Vec<Op> {
    use crate::erp::fragments::account_id;
    let mut ops = Vec::new();
    for (code, name, acct_type, normal_balance) in accounts {
        let frag = account_id(code);
        ops.push(Op::MapSet {
            fragment_id: frag.clone(),
            key: "code".to_string(),
            value: serde_json::json!(code),
        });
        ops.push(Op::MapSet {
            fragment_id: frag.clone(),
            key: "name".to_string(),
            value: serde_json::json!(name),
        });
        ops.push(Op::MapSet {
            fragment_id: frag.clone(),
            key: "type".to_string(),
            value: serde_json::json!(acct_type),
        });
        ops.push(Op::MapSet {
            fragment_id: frag,
            key: "normal_balance".to_string(),
            value: serde_json::json!(normal_balance),
        });
    }
    ops
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coa_templates_not_empty() {
        assert!(!general_sme_au_gst().is_empty());
        assert!(!services_low_inventory().is_empty());
        assert!(!product_manufacturing().is_empty());
    }

    #[test]
    fn test_coa_fragment_ids_prefixed() {
        let ops = general_sme_au_gst();
        for op in &ops {
            if let Op::MapSet { fragment_id, .. } = op {
                assert!(
                    fragment_id.starts_with("account:"),
                    "CoA fragment ID must start with 'account:': {}",
                    fragment_id
                );
            }
        }
    }
}
