use chrono::{DateTime, Utc};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;

lazy_static! {
    static ref AUDIT_LOCK: Mutex<()> = Mutex::new(());
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuditEvent {
    pub timestamp: String,
    pub user_id: String,
    pub action: String,      // e.g., "LOGIN", "SIGN_BLOCK", "ACCESS_DENIED"
    pub resource_id: String, // e.g., Block ID, Doc ID, or "SYSTEM"
    pub details: String,
    pub severity: String, // "INFO", "WARN", "ERROR", "CRITICAL"
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
    let _lock = AUDIT_LOCK.lock().unwrap();

    let file_path = "audit.jsonl";
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(file_path)
        .expect("Failed to open audit log file");

    if let Ok(json) = serde_json::to_string(&event) {
        if let Err(e) = writeln!(file, "{}", json) {
            eprintln!("CRITICAL: Failed to write to audit log: {}", e);
        }
    }
}
