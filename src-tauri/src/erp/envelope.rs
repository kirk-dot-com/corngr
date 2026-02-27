use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

use crate::erp::errors::ErpError;
use crate::erp::types::{ActorContext, Op, PolicyContext};

/// Canonical MutationEnvelope (IMPLEMENTATION_PLAN §2.2 / TECHNICAL_BLUEPRINT §3).
/// Every state change is wrapped in one of these and signed before being applied to yrs + audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutationEnvelope {
    pub envelope_version: String, // "1"
    pub org_id: String,
    pub mutation_id: String, // ULID string
    /// Hex-encoded Ed25519 public key of the acting user.
    pub actor_pubkey: String,
    /// Optional hex-encoded device public key for dual-key audit trail.
    pub device_pubkey: Option<String>,
    pub issued_at_ms: i64,
    /// Per-actor monotonic Lamport clock.
    pub lamport: u64,
    /// Hex-encoded SHA-256 of the preceding envelope in this actor's chain.
    /// "genesis" for the first envelope from an actor.
    pub prev_hash: String,
    pub capability_token_id: Option<String>,
    pub ops: Vec<Op>,
    pub policy_context: PolicyContext,
    /// Hex-encoded SHA-256 of the canonical ops JSON (sorted keys).
    pub content_hash: String,
    /// Hex-encoded Ed25519 signature over signing_payload().
    pub signature: String,
}

impl MutationEnvelope {
    /// Construct and sign a MutationEnvelope.
    /// Uses the node's persistent Ed25519 signing key.
    pub fn sign(
        mutation_id: String,
        actor: &ActorContext,
        ops: Vec<Op>,
        policy_context: PolicyContext,
        prev_hash: String,
    ) -> Result<Self, ErpError> {
        let now_ms = chrono::Utc::now().timestamp_millis();

        // 1. Compute content_hash over ops (canonical JSON)
        let ops_json = serde_json::to_string(&ops)
            .map_err(|e| ErpError::ValidationFail(format!("ops serialization: {}", e)))?;
        let mut hasher = Sha256::new();
        hasher.update(ops_json.as_bytes());
        let content_hash = hex::encode(hasher.finalize());

        // 2. Build signing payload:
        //    "1" || content_hash || prev_hash || lamport_be_bytes || issued_at_ms_be_bytes
        let payload = build_signing_payload("1", &content_hash, &prev_hash, actor.lamport, now_ms);

        // 3. Sign with node key
        let signing_key = get_signing_key();
        let signature: Signature = signing_key.sign(&payload);

        Ok(MutationEnvelope {
            envelope_version: "1".to_string(),
            org_id: actor.org_id.clone(),
            mutation_id,
            actor_pubkey: actor.pubkey.clone(),
            device_pubkey: None,
            issued_at_ms: now_ms,
            lamport: actor.lamport,
            prev_hash,
            capability_token_id: None,
            ops,
            policy_context,
            content_hash,
            signature: hex::encode(signature.to_bytes()),
        })
    }

    /// Verify the envelope's signature and content_hash integrity.
    pub fn verify(&self) -> Result<(), ErpError> {
        // 1. Recompute content_hash
        let ops_json = serde_json::to_string(&self.ops)
            .map_err(|e| ErpError::SigInvalid(format!("ops serialization: {}", e)))?;
        let mut hasher = Sha256::new();
        hasher.update(ops_json.as_bytes());
        let expected_hash = hex::encode(hasher.finalize());

        if expected_hash != self.content_hash {
            return Err(ErpError::SigInvalid(format!(
                "content_hash mismatch: expected {expected_hash}, got {}",
                self.content_hash
            )));
        }

        // 2. Reconstruct signing payload
        let payload = build_signing_payload(
            &self.envelope_version,
            &self.content_hash,
            &self.prev_hash,
            self.lamport,
            self.issued_at_ms,
        );

        // 3. Verify signature against actor_pubkey
        let pubkey_bytes = hex::decode(&self.actor_pubkey)
            .map_err(|e| ErpError::SigInvalid(format!("invalid actor_pubkey hex: {}", e)))?;
        let pubkey_arr: [u8; 32] = pubkey_bytes
            .try_into()
            .map_err(|_| ErpError::SigInvalid("actor_pubkey must be 32 bytes".to_string()))?;
        let verifying_key = VerifyingKey::from_bytes(&pubkey_arr)
            .map_err(|e| ErpError::SigInvalid(format!("invalid pubkey: {}", e)))?;

        let sig_bytes = hex::decode(&self.signature)
            .map_err(|e| ErpError::SigInvalid(format!("invalid signature hex: {}", e)))?;
        let sig_arr: [u8; 64] = sig_bytes
            .try_into()
            .map_err(|_| ErpError::SigInvalid("signature must be 64 bytes".to_string()))?;
        let sig = Signature::from_bytes(&sig_arr);

        verifying_key
            .verify(&payload, &sig)
            .map_err(|e| ErpError::SigInvalid(format!("signature verification failed: {}", e)))?;

        Ok(())
    }

    /// Returns the SHA-256 hash of this envelope (used as prev_hash for the next envelope).
    pub fn envelope_hash(&self) -> String {
        let json = serde_json::to_string(self).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(json.as_bytes());
        hex::encode(hasher.finalize())
    }
}

fn build_signing_payload(
    version: &str,
    content_hash: &str,
    prev_hash: &str,
    lamport: u64,
    issued_at_ms: i64,
) -> Vec<u8> {
    let mut payload = Vec::new();
    payload.extend_from_slice(version.as_bytes());
    payload.extend_from_slice(content_hash.as_bytes());
    payload.extend_from_slice(prev_hash.as_bytes());
    payload.extend_from_slice(&lamport.to_be_bytes());
    payload.extend_from_slice(&issued_at_ms.to_be_bytes());
    payload
}

// ── Key management (reuses the same pattern as lib.rs KeyManager) ──────────

const ERP_KEY_FILE: &str = "corngr_erp_node.key";

pub fn get_signing_key() -> SigningKey {
    if Path::new(ERP_KEY_FILE).exists() {
        if let Ok(bytes) = fs::read(ERP_KEY_FILE) {
            if bytes.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                return SigningKey::from_bytes(&arr);
            }
        }
    }
    use rand::rngs::OsRng;
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let _ = fs::write(ERP_KEY_FILE, signing_key.to_bytes());
    signing_key
}

pub fn get_actor_pubkey_hex() -> String {
    hex::encode(get_signing_key().verifying_key().to_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::erp::types::{Role, TxStatus};

    fn test_actor() -> ActorContext {
        ActorContext {
            pubkey: get_actor_pubkey_hex(),
            role: Role::Finance,
            org_id: "org1".to_string(),
            lamport: 1,
        }
    }

    fn test_policy() -> PolicyContext {
        PolicyContext {
            org_id: "org1".to_string(),
            tx_id: Some("tx_test".to_string()),
            tx_status: Some(TxStatus::Draft),
        }
    }

    #[test]
    fn test_mutation_envelope_sign_verify() {
        let actor = test_actor();
        let ops = vec![crate::erp::types::Op::MapSet {
            fragment_id: "tx:tx1:hdr".to_string(),
            key: "status".to_string(),
            value: serde_json::json!("draft"),
        }];

        let envelope = MutationEnvelope::sign(
            "mut-001".to_string(),
            &actor,
            ops,
            test_policy(),
            "genesis".to_string(),
        )
        .expect("envelope sign should succeed");

        assert!(
            envelope.verify().is_ok(),
            "envelope verify should succeed: {:?}",
            envelope.verify()
        );
    }

    #[test]
    fn test_envelope_tamper_detection() {
        let actor = test_actor();
        let ops = vec![crate::erp::types::Op::MapSet {
            fragment_id: "tx:tx1:hdr".to_string(),
            key: "status".to_string(),
            value: serde_json::json!("draft"),
        }];

        let mut envelope = MutationEnvelope::sign(
            "mut-002".to_string(),
            &actor,
            ops,
            test_policy(),
            "genesis".to_string(),
        )
        .expect("sign");

        // Tamper with content_hash
        envelope.content_hash = "deadbeef".to_string();
        assert!(
            envelope.verify().is_err(),
            "tampered envelope should fail verification"
        );
    }
}
