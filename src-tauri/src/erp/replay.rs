use crate::erp::errors::ErpError;
use std::collections::{HashMap, HashSet};

/// Per-actor replay protection state.
/// Maintained in-process; survives for the lifetime of the engine state.
/// In Phase B this would be persisted to disk / Primary's canonical store.
#[derive(Debug, Default)]
pub struct ReplayGuard {
    /// Per-actor-pubkey maximum lamport clock seen.
    pub max_lamport: HashMap<String, u64>,
    /// Set of mutation_id strings already seen.
    pub seen_mutations: HashSet<String>,
}

impl ReplayGuard {
    pub fn new() -> Self {
        Self::default()
    }

    /// Call before applying any MutationEnvelope.
    /// Returns Err if the mutation is a replay or the lamport counter has rewound.
    pub fn check_and_record(
        &mut self,
        actor_pubkey: &str,
        mutation_id: &str,
        lamport: u64,
    ) -> Result<(), ErpError> {
        // 1. Check mutation_id uniqueness
        if self.seen_mutations.contains(mutation_id) {
            return Err(ErpError::ReplayMutationId(mutation_id.to_string()));
        }

        // 2. Check lamport monotonicity per actor
        if let Some(&max) = self.max_lamport.get(actor_pubkey) {
            if lamport <= max {
                return Err(ErpError::LamportRewind(lamport, max));
            }
        }

        // 3. Record
        self.seen_mutations.insert(mutation_id.to_string());
        self.max_lamport.insert(actor_pubkey.to_string(), lamport);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replay_protection() {
        let mut guard = ReplayGuard::new();

        // First call succeeds
        assert!(guard.check_and_record("pubkey1", "mut-001", 1).is_ok());

        // Duplicate mutation_id → ERR_REPLAY_MUTATION_ID
        let err = guard.check_and_record("pubkey1", "mut-001", 2).unwrap_err();
        assert_eq!(err.code(), "ERR_REPLAY_MUTATION_ID");

        // Different mutation_id but lamport not incremented → ERR_LAMPORT_REWIND
        let err = guard.check_and_record("pubkey1", "mut-002", 1).unwrap_err();
        assert_eq!(err.code(), "ERR_LAMPORT_REWIND");

        // Correct increment succeeds
        assert!(guard.check_and_record("pubkey1", "mut-002", 2).is_ok());

        // Different actor starts fresh
        assert!(guard.check_and_record("pubkey2", "mut-003", 1).is_ok());
    }
}
