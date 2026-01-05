use super::*;
use std::fs;

#[test]
fn test_merkle_chain_integrity() {
    // 1. Cleanup previous runs
    let _ = fs::remove_file("audit_test.jsonl");

    // 2. Override filename for test (requires modifying mod.rs to accept path, or just mocking)
    // Since we hardcoded "audit.jsonl", we'll just test the logic by calling log_event or append_log_chained.
    // Note: This relies on the global LAST_HASH state.

    let mut event1 = AuditEvent::new("user1", "LOGIN", "system", "first event", "INFO");
    let mut event2 = AuditEvent::new("user1", "EDIT", "block1", "second event", "INFO");
    let mut event3 = AuditEvent::new("user2", "LOGOUT", "system", "third event", "INFO");

    // 3. Append events
    append_log_chained(&mut event1).expect("Failed to log event 1");
    append_log_chained(&mut event2).expect("Failed to log event 2");
    append_log_chained(&mut event3).expect("Failed to log event 3");

    // 4. Verify Chained Hashes
    assert!(event1.hash.is_some());
    assert!(event2.prev_hash == event1.hash);
    assert!(event3.prev_hash == event2.hash);

    println!("✅ Merkle Chain Integrity Verified!");
    println!("E1 Hash: {:?}", event1.hash);
    println!("E2 Prev: {:?}", event2.prev_hash);
    println!("E2 Hash: {:?}", event2.hash);
    println!("E3 Prev: {:?}", event3.prev_hash);
}
