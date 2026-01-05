use chrono::Utc;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::sync::Mutex;

lazy_static! {
    static ref AUDIT_LOCK: Mutex<()> = Mutex::new(());
    // Global state for hash chaining (in-memory only for prototype, lost on restart)
    static ref LAST_HASH: Mutex<String> = Mutex::new("genesis_hash".to_string());
}

pub mod shipper;

#[cfg(test)]
mod verification_test;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuditEvent {
    pub timestamp: String,
    pub user_id: String,
    pub action: String,      // e.g., "LOGIN", "SIGN_BLOCK", "ACCESS_DENIED"
    pub resource_id: String, // e.g., Block ID, Doc ID, or "SYSTEM"
    pub details: String,
    pub severity: String, // "INFO", "WARN", "ERROR", "CRITICAL"
    pub prev_hash: Option<String>,
    pub hash: Option<String>,
}

impl AuditEvent {
    pub fn new(
        user_id: &str,
        action: &str,
        resource_id: &str,
        details: &str,
        severity: &str,
    ) -> Self {
        Self {
            timestamp: Utc::now().to_rfc3339(),
            user_id: user_id.to_string(),
            action: action.to_string(),
            resource_id: resource_id.to_string(),
            details: details.to_string(),
            severity: severity.to_string(),
            prev_hash: None, // Calculated at append time
            hash: None,      // Calculated at append time
        }
    }
}

pub fn log_event(event: AuditEvent) {
    // 1. Print to console for immediate dev feedback
    let icon = match event.severity.as_str() {
        "CRITICAL" => "🚨",
        "ERROR" => "❌",
        "WARN" => "⚠️",
        _ => "🛡️",
    };
    println!(
        "{} AUDIT [{}]: {} performed {} on {}. ({})",
        icon, event.timestamp, event.user_id, event.action, event.resource_id, event.details
    );

    // 2. Append to persistent file
    let _lock = AUDIT_LOCK.lock().unwrap(); // Use mut if we add state later, currently just locking file access

    // For Merkle/Chain, we need the last hash.
    // In a real app we'd read the last line or cache it in memory.
    // Let's modify append_log to handle this calculation.

    // We need to pass a mutable event to update its hash, but `log_event` takes ownership.
    // Let's modify `event` locally before appending.
    let mut chained_event = event.clone();

    // Calculate Hash (Simplified for Phase 1: Just hash this event + salt)
    // To do real chaining, we need state. Let's add a static LAST_HASH?
    // Doing it inside append_log is safer if we hold the lock.

    if let Err(e) = append_log_chained(&mut chained_event) {
        eprintln!("CRITICAL: Failed to write to audit log: {}", e);
    }

    // 3. Ship to External SIEM (Async)
    let event_to_ship = chained_event.clone();
    tauri::async_runtime::spawn(async move {
        use crate::audit::shipper::{LogShipper, MockShipper};
        let shipper = MockShipper;
        if let Err(e) = shipper.ship_event(&event_to_ship).await {
            eprintln!("❌ FILTERED: Failed to ship audit event: {}", e);
        }
    });
}

pub fn append_log_chained(event: &mut AuditEvent) -> std::io::Result<()> {
    use sha2::{Digest, Sha256};

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("audit.jsonl")?;

    let mut writer = std::io::LineWriter::new(file);

    // update chaining
    let mut last_hash_guard = LAST_HASH.lock().unwrap();
    event.prev_hash = Some(last_hash_guard.clone());

    // Calculate current hash: sha256(timestamp + user + action + prev_hash)
    let mut hasher = Sha256::new();
    hasher.update(&event.timestamp);
    hasher.update(&event.user_id);
    hasher.update(&event.action);
    hasher.update(&event.details);
    hasher.update(event.prev_hash.as_ref().unwrap());

    let result = hasher.finalize();
    let hash_hex = hex::encode(result);

    event.hash = Some(hash_hex.clone());
    *last_hash_guard = hash_hex;

    let json = serde_json::to_string(event)?;
    writeln!(writer, "{}", json)?;
    Ok(())
}

pub fn read_log(limit: usize) -> std::io::Result<Vec<AuditEvent>> {
    let file = File::open("audit.jsonl");
    match file {
        Ok(f) => {
            let reader = BufReader::new(f);
            let mut events = Vec::new();

            // Read all lines, parse, then take last N
            // Ideally we read from end, but for MVP reading all is fine (audit log small dev)
            for line in reader.lines() {
                if let Ok(l) = line {
                    if let Ok(event) = serde_json::from_str::<AuditEvent>(&l) {
                        events.push(event);
                    }
                }
            }

            events.reverse(); // Newest first
            if events.len() > limit {
                events.truncate(limit);
            }
            Ok(events)
        }
        Err(_) => Ok(Vec::new()), // Return empty if no log file yet
    }
}
