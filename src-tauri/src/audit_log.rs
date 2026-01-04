use chrono::Utc;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::sync::Mutex;
use tauri::State;

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

    if let Err(e) = append_log(&event) {
        eprintln!("CRITICAL: Failed to write to audit log: {}", e);
    }
}

pub fn append_log(event: &AuditEvent) -> std::io::Result<()> {
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("audit.jsonl")?;

    let mut writer = std::io::LineWriter::new(file);
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
