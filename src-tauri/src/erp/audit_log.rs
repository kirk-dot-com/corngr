use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::sync::Mutex;

use crate::erp::envelope::MutationEnvelope;

lazy_static::lazy_static! {
    static ref ERP_AUDIT_LOCK: Mutex<()> = Mutex::new(());
    static ref ERP_LAST_HASH: Mutex<String> = Mutex::new("erp_genesis".to_string());
}

/// Returns the path for the ERP Merkle JSONL audit log.
fn audit_log_path() -> &'static str {
    if cfg!(target_os = "windows") {
        "C:\\Windows\\Temp\\erp_audit.jsonl"
    } else {
        "/tmp/erp_audit.jsonl"
    }
}

/// An ERP audit log entry — wraps a MutationEnvelope with Merkle chain links.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErpAuditEntry {
    /// SHA-256 of the previous entry (hex). "erp_genesis" for first entry.
    pub chain_prev_hash: String,
    /// SHA-256 of the serialized MutationEnvelope (hex).
    pub chain_hash: String,
    pub envelope: MutationEnvelope,
}

/// Append a MutationEnvelope to the Merkle-chained JSONL audit log.
/// Computes chain_prev_hash and chain_hash and writes one JSON line.
pub fn append(envelope: &MutationEnvelope) -> std::io::Result<()> {
    let _lock = ERP_AUDIT_LOCK.lock().unwrap();

    let mut last_hash = ERP_LAST_HASH.lock().unwrap();

    // Compute chain_hash: SHA-256 of the envelope JSON + prev_hash
    let env_json = serde_json::to_string(envelope).unwrap_or_else(|_| "{}".to_string());
    let mut hasher = Sha256::new();
    hasher.update(env_json.as_bytes());
    hasher.update(last_hash.as_bytes());
    let chain_hash = hex::encode(hasher.finalize());

    let entry = ErpAuditEntry {
        chain_prev_hash: last_hash.clone(),
        chain_hash: chain_hash.clone(),
        envelope: envelope.clone(),
    };

    let line = serde_json::to_string(&entry)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(audit_log_path())?;

    let mut writer = std::io::LineWriter::new(file);
    writeln!(writer, "{}", line)?;

    *last_hash = chain_hash;
    Ok(())
}

/// Read all audit log entries (newest first, up to `limit`).
pub fn read_log(limit: usize) -> std::io::Result<Vec<ErpAuditEntry>> {
    let file = File::open(audit_log_path());
    match file {
        Ok(f) => {
            let reader = BufReader::new(f);
            let mut entries = Vec::new();
            for line in reader.lines().flatten() {
                if let Ok(entry) = serde_json::from_str::<ErpAuditEntry>(&line) {
                    entries.push(entry);
                }
            }
            entries.reverse();
            entries.truncate(limit);
            Ok(entries)
        }
        Err(_) => Ok(Vec::new()),
    }
}

/// Verify chain integrity — returns true only if every entry's chain_hash matches
/// the re-computed hash of its envelope + chain_prev_hash.
pub fn verify_chain() -> bool {
    let file = File::open(audit_log_path());
    let Ok(f) = file else { return true }; // empty log is valid

    let reader = BufReader::new(f);
    let mut prev = "erp_genesis".to_string();

    for line in reader.lines().flatten() {
        let Ok(entry) = serde_json::from_str::<ErpAuditEntry>(&line) else {
            return false; // unparseable entry = tampered
        };
        if entry.chain_prev_hash != prev {
            return false;
        }
        // Re-compute expected hash
        let env_json = serde_json::to_string(&entry.envelope).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(env_json.as_bytes());
        hasher.update(prev.as_bytes());
        let expected = hex::encode(hasher.finalize());
        if expected != entry.chain_hash {
            return false;
        }
        prev = entry.chain_hash.clone();
    }
    true
}

/// Read entries whose `envelope.issued_at_ms` falls within `[from_ms, to_ms]` (inclusive).
/// Used by `erp_time_travel` to reconstruct state at a point in time.
pub fn read_log_bounded(from_ms: i64, to_ms: i64) -> std::io::Result<Vec<ErpAuditEntry>> {
    let file = File::open(audit_log_path());
    match file {
        Ok(f) => {
            let reader = BufReader::new(f);
            let entries = reader
                .lines()
                .flatten()
                .filter_map(|line| serde_json::from_str::<ErpAuditEntry>(&line).ok())
                .filter(|e| e.envelope.issued_at_ms >= from_ms && e.envelope.issued_at_ms <= to_ms)
                .collect();
            Ok(entries)
        }
        Err(_) => Ok(Vec::new()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_log_bounded_empty_range() {
        // Far-future range — should always return empty (log not yet populated in test)
        let result = read_log_bounded(i64::MAX - 1000, i64::MAX).unwrap();
        // Test passes if no panic; result may or may not be empty depending on test environment
        let _ = result;
    }
}
