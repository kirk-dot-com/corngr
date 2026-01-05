use crate::audit_log::AuditEvent;
use async_trait::async_trait;
use std::error::Error;

/// Trait for shipping audit logs to external systems (SIEM, Splunk, ELK)
#[async_trait]
pub trait LogShipper: Send + Sync {
    /// Ship a single event asynchronously
    async fn ship_event(&self, event: &AuditEvent) -> Result<(), Box<dyn Error + Send + Sync>>;

    /// Flush any buffered events
    async fn flush(&self) -> Result<(), Box<dyn Error + Send + Sync>>;
}

pub struct MockShipper;

#[async_trait]
impl LogShipper for MockShipper {
    async fn ship_event(&self, event: &AuditEvent) -> Result<(), Box<dyn Error + Send + Sync>> {
        // In a real implementation, this would HTTP POST to Splunk/ELK
        // For Phase 1, we just println to stdout with a special prefix
        println!(
            "🚢 SHIP_LOG: [{}][{}] {}",
            event.severity, event.action, event.details
        );
        Ok(())
    }

    async fn flush(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        Ok(())
    }
}
