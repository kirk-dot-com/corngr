use crate::erp::errors::ErpError;
use crate::erp::types::{ActorContext, PolicyContext, Role, TxStatus};

/// Actions that can be checked against ABAC policies.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    TxCreate,
    TxEdit,
    TxPost,
    TxReverse,
    TxVoid,
    PostingCreate,
    PostingFinalize,
    InvMoveCreate,
    IndexUpdate, // engine-only
    AuditRead,
}

impl Action {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "tx.create" => Some(Action::TxCreate),
            "tx.edit" => Some(Action::TxEdit),
            "tx.post" => Some(Action::TxPost),
            "tx.reverse" => Some(Action::TxReverse),
            "tx.void" => Some(Action::TxVoid),
            "posting.create" => Some(Action::PostingCreate),
            "posting.finalize" => Some(Action::PostingFinalize),
            "invmove.create" => Some(Action::InvMoveCreate),
            "index.update" => Some(Action::IndexUpdate),
            "audit.read" => Some(Action::AuditRead),
            _ => None,
        }
    }
}

/// The primary ABAC check function.
/// Evaluates Phase A policies (from SCHEMA_BRIDGE_MAPPING §1.4 + ADR-0001).
/// Returns Ok(()) if allowed, Err(ErpError::AbacDeny) if denied.
pub fn check_abac(
    actor: &ActorContext,
    action: &Action,
    context: &PolicyContext,
) -> Result<(), ErpError> {
    match action {
        // P1: tx.create/edit — staff/manager/finance; status ∈ {draft, proposed}
        Action::TxCreate => {
            require_role(
                actor,
                &[Role::Staff, Role::Manager, Role::Finance, Role::OwnerAdmin],
            )?;
            Ok(())
        }
        Action::TxEdit => {
            require_role(
                actor,
                &[Role::Staff, Role::Manager, Role::Finance, Role::OwnerAdmin],
            )?;
            // Must not be on a posted/void tx
            if let Some(status) = &context.tx_status {
                match status {
                    TxStatus::Posted | TxStatus::Void => {
                        return Err(ErpError::AbacDeny(format!(
                            "tx.edit denied: tx is {}",
                            status.as_str()
                        )));
                    }
                    _ => {}
                }
            }
            Ok(())
        }

        // P2: posting.create/finalize — finance; manager below threshold (Phase A: finance only)
        Action::PostingCreate | Action::PostingFinalize => {
            require_role(actor, &[Role::Finance, Role::OwnerAdmin])?;
            Ok(())
        }

        // P3: invmove.create — staff/manager/finance; tx not posted
        Action::InvMoveCreate => {
            require_role(
                actor,
                &[Role::Staff, Role::Manager, Role::Finance, Role::OwnerAdmin],
            )?;
            if let Some(TxStatus::Posted) = &context.tx_status {
                return Err(ErpError::AbacDeny(
                    "invmove.create denied: tx is posted".to_string(),
                ));
            }
            Ok(())
        }

        // P4: tx.post — finance; approval atom required (validated in post_tx, not here)
        Action::TxPost => {
            require_role(actor, &[Role::Finance, Role::OwnerAdmin])?;
            Ok(())
        }

        // P5: tx.reverse — finance; approval atom required
        Action::TxReverse => {
            require_role(actor, &[Role::Finance, Role::OwnerAdmin])?;
            Ok(())
        }

        Action::TxVoid => {
            require_role(actor, &[Role::Manager, Role::Finance, Role::OwnerAdmin])?;
            // Cannot void a posted tx
            if let Some(TxStatus::Posted) = &context.tx_status {
                return Err(ErpError::AbacDeny(
                    "tx.void denied: tx is posted; use tx.reverse".to_string(),
                ));
            }
            Ok(())
        }

        // P6: index.update — engine-only; always deny from non-Engine actors
        Action::IndexUpdate => {
            if actor.role != Role::Engine {
                return Err(ErpError::AbacDeny(
                    "index.update is engine-only and cannot be called externally".to_string(),
                ));
            }
            Ok(())
        }

        // audit.read — auditor/finance/owner_admin
        Action::AuditRead => {
            require_role(actor, &[Role::Auditor, Role::Finance, Role::OwnerAdmin])?;
            Ok(())
        }
    }
}

/// Helper: deny with ERR_ABAC_DENY if actor's role is not in the allowed set.
fn require_role(actor: &ActorContext, allowed: &[Role]) -> Result<(), ErpError> {
    if allowed.contains(&actor.role) {
        Ok(())
    } else {
        Err(ErpError::AbacDeny(format!(
            "role '{}' is not permitted for this action",
            actor.role.as_str()
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn staff_actor() -> ActorContext {
        ActorContext {
            pubkey: "pubkey_staff".to_string(),
            role: Role::Staff,
            org_id: "org1".to_string(),
            lamport: 1,
        }
    }

    fn finance_actor() -> ActorContext {
        ActorContext {
            pubkey: "pubkey_finance".to_string(),
            role: Role::Finance,
            org_id: "org1".to_string(),
            lamport: 1,
        }
    }

    fn auditor_actor() -> ActorContext {
        ActorContext {
            pubkey: "pubkey_auditor".to_string(),
            role: Role::Auditor,
            org_id: "org1".to_string(),
            lamport: 1,
        }
    }

    fn ctx() -> PolicyContext {
        PolicyContext {
            org_id: "org1".to_string(),
            tx_id: Some("tx1".to_string()),
            tx_status: Some(TxStatus::Draft),
        }
    }

    #[test]
    fn test_abac_staff_denied_posting() {
        let result = check_abac(&staff_actor(), &Action::PostingCreate, &ctx());
        assert!(matches!(result, Err(ErpError::AbacDeny(_))));
    }

    #[test]
    fn test_abac_finance_allowed_post() {
        let mut c = ctx();
        c.tx_status = Some(TxStatus::Approved);
        let result = check_abac(&finance_actor(), &Action::TxPost, &c);
        assert!(
            result.is_ok(),
            "finance should be allowed to post: {:?}",
            result
        );
    }

    #[test]
    fn test_abac_auditor_denied_tx_create() {
        let result = check_abac(&auditor_actor(), &Action::TxCreate, &ctx());
        assert!(matches!(result, Err(ErpError::AbacDeny(_))));
    }

    #[test]
    fn test_abac_index_update_engine_only() {
        // Non-engine actor denied
        let result = check_abac(&finance_actor(), &Action::IndexUpdate, &ctx());
        assert!(matches!(result, Err(ErpError::AbacDeny(_))));

        // Engine actor allowed
        let engine = ActorContext {
            pubkey: "engine".to_string(),
            role: Role::Engine,
            org_id: "org1".to_string(),
            lamport: 0,
        };
        let result = check_abac(&engine, &Action::IndexUpdate, &ctx());
        assert!(result.is_ok());
    }

    #[test]
    fn test_abac_edit_denied_on_posted_tx() {
        let mut c = ctx();
        c.tx_status = Some(TxStatus::Posted);
        let result = check_abac(&finance_actor(), &Action::TxEdit, &c);
        assert!(matches!(result, Err(ErpError::AbacDeny(_))));
    }
}
