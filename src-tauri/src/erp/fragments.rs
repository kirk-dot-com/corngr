/// Fragment ID helpers — all ERP fragment IDs are derived from stable ULID-based entity IDs.
/// These functions produce the canonical yrs map key (fragment ID) for each entity type.
/// Pattern mirrors SCHEMA_SPEC.md § Fragment Layout.

pub fn tx_hdr_id(tx_id: &str) -> String {
    format!("tx:{}:hdr", tx_id)
}

pub fn tx_lines_id(tx_id: &str) -> String {
    format!("tx:{}:lines", tx_id)
}

pub fn tx_postings_id(tx_id: &str) -> String {
    format!("tx:{}:postings", tx_id)
}

pub fn txline_id(line_id: &str) -> String {
    format!("txline:{}", line_id)
}

pub fn posting_id(posting_id: &str) -> String {
    format!("posting:{}", posting_id)
}

pub fn invmove_id(move_id: &str) -> String {
    format!("invmove:{}", move_id)
}

pub fn approval_id(appr_id: &str) -> String {
    format!("approval:{}", appr_id)
}

pub fn account_id(acct_id: &str) -> String {
    format!("account:{}", acct_id)
}

pub fn party_id(party_id: &str) -> String {
    format!("party:{}", party_id)
}

pub fn org_indexes_id(org_id: &str) -> String {
    format!("org:{}:indexes", org_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fragment_ids_stable() {
        assert_eq!(tx_hdr_id("abc123"), "tx:abc123:hdr");
        assert_eq!(tx_lines_id("abc123"), "tx:abc123:lines");
        assert_eq!(tx_postings_id("abc123"), "tx:abc123:postings");
        assert_eq!(txline_id("line1"), "txline:line1");
        assert_eq!(posting_id("p1"), "posting:p1");
        assert_eq!(invmove_id("m1"), "invmove:m1");
        assert_eq!(approval_id("a1"), "approval:a1");
        assert_eq!(account_id("acct1"), "account:acct1");
        assert_eq!(party_id("party1"), "party:party1");
        assert_eq!(org_indexes_id("org1"), "org:org1:indexes");
    }
}
