use crate::erp::errors::ErpError;
use crate::erp::types::TxStatus;

/// Enforces the transaction status state machine.
/// Valid transitions:
///   draft → proposed → approved → posted (immutable)
///   draft → void
///   proposed → void
/// All others → ERR_INVALID_STATUS
pub fn transition(current: &TxStatus, target: &TxStatus) -> Result<TxStatus, ErpError> {
    let allowed = match current {
        TxStatus::Draft => matches!(target, TxStatus::Proposed | TxStatus::Void),
        TxStatus::Proposed => matches!(target, TxStatus::Approved | TxStatus::Void),
        TxStatus::Approved => matches!(target, TxStatus::Posted),
        TxStatus::Posted => false, // immutable; reversals create a new tx
        TxStatus::Void => false,   // terminal
    };

    if allowed {
        Ok(target.clone())
    } else {
        Err(ErpError::InvalidStatus(
            current.as_str().to_string(),
            target.as_str().to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_machine_valid_transitions() {
        assert!(transition(&TxStatus::Draft, &TxStatus::Proposed).is_ok());
        assert!(transition(&TxStatus::Draft, &TxStatus::Void).is_ok());
        assert!(transition(&TxStatus::Proposed, &TxStatus::Approved).is_ok());
        assert!(transition(&TxStatus::Proposed, &TxStatus::Void).is_ok());
        assert!(transition(&TxStatus::Approved, &TxStatus::Posted).is_ok());
    }

    #[test]
    fn test_status_machine_invalid_transitions() {
        // Skip transitions
        assert_eq!(
            transition(&TxStatus::Draft, &TxStatus::Posted),
            Err(ErpError::InvalidStatus("draft".into(), "posted".into()))
        );
        assert_eq!(
            transition(&TxStatus::Draft, &TxStatus::Approved),
            Err(ErpError::InvalidStatus("draft".into(), "approved".into()))
        );
        // Posted is immutable
        assert_eq!(
            transition(&TxStatus::Posted, &TxStatus::Void),
            Err(ErpError::InvalidStatus("posted".into(), "void".into()))
        );
        // Void is terminal
        assert_eq!(
            transition(&TxStatus::Void, &TxStatus::Draft),
            Err(ErpError::InvalidStatus("void".into(), "draft".into()))
        );
    }
}
