use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use uuid::Uuid;

// ==========================================
// [EIM] Schema Definitions (Mirroring TS)
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Provenance {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "sourceDocId")]
    pub source_doc_id: Option<String>,
    #[serde(rename = "authorId")]
    pub author_id: String,
    pub timestamp: String,
    #[serde(rename = "originUrl")]
    pub origin_url: Option<String>,
    pub signature: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Metadata {
    #[serde(rename = "slideIndex")]
    pub slide_index: Option<i32>,
    pub layout: Option<String>,
    pub acl: Option<Vec<String>>, // Specific user/role IDs allowed to see this
    pub classification: Option<String>, // public, internal, confidential
    pub provenance: Option<Provenance>,
    pub locked: Option<bool>, // Phase 2: Edit protection
    #[serde(rename = "originDocId")]
    pub origin_doc_id: Option<String>,
    #[serde(rename = "originUrl")]
    pub origin_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapabilityRequest {
    pub origin_url: String,
    pub doc_id: String,
    pub block_id: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapabilityToken {
    pub token_id: String,
    pub expires_at: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariableValue {
    pub name: String,
    pub value: serde_json::Value,
    pub format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlockData {
    pub text: Option<String>,
    pub value: Option<VariableValue>,
    pub metadata: Metadata,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Block {
    pub id: String,
    pub type_: String, // 'type' is reserved in Rust, mapped via serde if needed (but manual here)
    #[serde(rename = "type")]
    pub block_type: String,
    pub data: BlockData,
    pub created: String,
    pub modified: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    // Frontend sends 'attributes' object, but here we flatten or map carefully.
    // In our shared 'types.ts', User has 'attributes: { role, department }'
    // But in our rust command we expect 'User' object.
    // Let's adjust to match the TS interface exactly or use a flattened approach?
    // TS: interface User { id: string; attributes: { role: Role; ... } }
    // Rust: We defined flattened fields. This is causing mismatch too!
    // We need to match the TS structure or write a custom deserializer.
    // Easier fix: Update TS to send flat object? No, better Update Rust to match nested structure.
    pub attributes: UserAttributes,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAttributes {
    pub role: String,
    pub department: Option<String>,
    #[serde(rename = "clearanceLevel")]
    pub clearance_level: Option<i32>,
}

// ==========================================
// [EIM] Security Logic (ABAC)
// ==========================================

fn check_access(user: &User, block: &Block, action: &str) -> bool {
    let attrs = &user.attributes;

    // 1. Admin Override
    if attrs.role == "admin" {
        return true;
    }

    // 2. Action Capabilities (Role-Based High Level)
    if action == "write" {
        if attrs.role != "editor" && attrs.role != "admin" {
            return false;
        }
    }

    let meta = &block.data.metadata;

    // 3. ACL Check (Role-Based Resource Level)
    if let Some(acl) = &meta.acl {
        if !acl.is_empty() && !acl.contains(&attrs.role) && !acl.contains(&user.id) {
            return false;
        }
    }

    // 4. Classification Check (Attribute-Based)
    if let Some(classification) = &meta.classification {
        let clearance = attrs.clearance_level.unwrap_or(0);
        match classification.as_str() {
            "public" => true,
            "internal" => true, // Assuming all logged-in users are internal
            "confidential" => clearance >= 2,
            "restricted" => clearance >= 3,
            _ => false,
        }
    } else {
        // Default to visible if no classification
        true
    }
}

// ==========================================
// Tauri Commands
// ==========================================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn check_block_permission(user: User, block_id: String, action: String) -> bool {
    // Load current state from disk to check permissions against latest logic
    // Efficiency Note: In prod, we'd query a DB, not read generic JSON file
    let file_path = "demo.crng";
    let blocks: Vec<Block> = if std::path::Path::new(file_path).exists() {
        std::fs::read_to_string(file_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_else(get_mock_blocks)
    } else {
        get_mock_blocks()
    };

    if let Some(block) = blocks.iter().find(|b| b.id == block_id) {
        return check_access(&user, block, &action);
    }
    false // Block not found, default to deny
}

/**
 * [Sprint 3] Fetch External Block
 * Authoritative cross-origin request handler.
 * Validates permissions against the remote document's logic.
 */
#[tauri::command]
fn fetch_external_block(
    user: User,
    origin_url: String,
    doc_id: String,
    block_id: String,
    token: Option<String>, // [Sprint 4] Optional capability token
) -> Result<Block, String> {
    println!(
        "🌐 [Sprint 4] Remote Fetch Request: User {} -> Origin {} | Doc {} | Block {} | Token: {:?}",
        user.id, origin_url, doc_id, block_id, token
    );

    // 1. Simulate finding the remote document
    // In a real system, we'd fetch from another .crng file or a remote server
    let blocks = get_mock_blocks();

    if let Some(mut block) = blocks.into_iter().find(|b| b.id == block_id) {
        // [Phase 4] Verify Capability Token if present (High-Speed Access)
        if let Some(token_str) = token {
            // In a real system, we'd parse the full CapabilityToken struct.
            // For now, we assume the string passed is "token_id|signature" or similar,
            // OR we just verify the token signature if we had the object.
            // But valid `token` arg is currently just a string.
            // Let's assume the frontend passes the entire JSON of the token?
            // Or simpler: pass "token_id:signature".
            // Let's implement a simple split for now to verify logic.
            if let Some((t_id, sig)) = token_str.split_once(':') {
                if verify_token(t_id, sig) {
                    println!("✅ CRYPTO PROOF: Valid Signature for Token {}", t_id);
                    // Fast-path allow!
                    block.data.metadata.origin_doc_id = Some(doc_id);
                    block.data.metadata.origin_url = Some(origin_url);
                    return Ok(block);
                } else {
                    println!("❌ CRYPTO FAIL: Invalid Signature for Token {}", t_id);
                }
            }
        }

        // 2. Perform Authoritative ABAC Check (Fallback)
        if check_access(&user, &block, "read") {
            // Enrich with origin metadata to ensure receiver knows it's external
            block.data.metadata.origin_doc_id = Some(doc_id);
            block.data.metadata.origin_url = Some(origin_url);

            println!("✅ Remote Access Granted: {}", block_id);
            return Ok(block);
        } else {
            println!("🔒 Remote Access Denied for User {}", user.id);
            return Err("Permission Denied: Origin ABAC rejected request".into());
        }
    }

    Err("Block not found in remote document".into())
}

/**
 * [Sprint 4] Request Capability Token
 * Pre-flight authorization for high-speed transclusion.
 * Returns an ephemeral token that can be swapped for block data.
 */
#[tauri::command]
fn request_capability_token(req: CapabilityRequest) -> Result<CapabilityToken, String> {
    println!(
        "🔑 [Sprint 4] Capability Handshake: User {} requesting pre-flight for {} in {}",
        req.user.id, req.block_id, req.doc_id
    );

    // 1. Load the target block to verify access
    let blocks = get_mock_blocks();
    let block = blocks.into_iter().find(|b| b.id == req.block_id);

    if let Some(b) = block {
        // 2. Perform ABAC check
        if check_access(&req.user, &b, "read") {
            // 3. Generate Ephemeral Token (Real Ed25519 Signature)
            let token_id = format!("cap-{}", Uuid::new_v4());
            let signature = sign_token(&token_id);

            let token = CapabilityToken {
                token_id,
                expires_at: (chrono::Utc::now() + chrono::Duration::seconds(300)).to_rfc3339(),
                signature,
            };

            println!("✅ Handshake Successful: Token Issued ({})", token.token_id);
            return Ok(token);
        }
    }

    println!(
        "🔒 Handshake Denied: User {} has no clearance for {}",
        req.user.id, req.block_id
    );
    Err("Handshake Failed: Access Denied".into())
}

// ==========================================
// [Phase 4] Cryptographic Key Management
// ==========================================

const KEY_FILE: &str = "corngr_node.key";

struct KeyManager;

impl KeyManager {
    /// Loads or generates a persistent Ed25519 signing key for this node
    fn get_signing_key() -> SigningKey {
        if Path::new(KEY_FILE).exists() {
            // Load existing key
            let bytes = fs::read(KEY_FILE).expect("Failed to read key file");
            if bytes.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                return SigningKey::from_bytes(&arr);
            }
        }

        // Generate new key
        println!("🔑 Generating new Identity Key for this node...");
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        fs::write(KEY_FILE, signing_key.to_bytes()).expect("Failed to write key file");
        signing_key
    }

    fn get_public_key() -> VerifyingKey {
        let signing_key = Self::get_signing_key();
        signing_key.verifying_key()
    }
}

/**
 * [Phase 4] Real Ed25519 Signing
 */
fn sign_token(token_id: &str) -> String {
    let signing_key = KeyManager::get_signing_key();
    let signature: Signature = signing_key.sign(token_id.as_bytes());
    hex::encode(signature.to_bytes())
}

/**
 * [Phase 4] Real Ed25519 Verification
 */
fn verify_token(token_id: &str, signature_hex: &str) -> bool {
    let public_key = KeyManager::get_public_key();

    // Decode hex signature
    if let Ok(sig_bytes) = hex::decode(signature_hex) {
        if let Ok(byte_array) = sig_bytes.try_into() {
            let signature = Signature::from_bytes(&byte_array);
            return public_key.verify(token_id.as_bytes(), &signature).is_ok();
        }
    }
    false
}

/**
 * [EIM] Audit Logger
 * Phase 2.4: Records security-sensitive metadata changes.
 * In a production system, this would write to a secure audit DB or immutable ledger.
 */
fn audit_log(user_id: &str, action: &str, resource_id: &str, detail: &str) {
    println!(
        "🛡️  AUDIT [{}]: User {} performed {} on {}. Detail: {}",
        chrono::Utc::now().to_rfc3339(),
        user_id,
        action,
        resource_id,
        detail
    );
}

/**
 * [EIM] Load Secure Document
 * Reads from "demo.crng" (simulated DB) and filters based on User Context.
 */
#[tauri::command]
fn load_secure_document(user: User) -> Vec<Block> {
    // 1. Load from Disk (The "Server Truth")
    let file_path = "demo.crng";
    let raw_blocks: Vec<Block> = if std::path::Path::new(file_path).exists() {
        match std::fs::read_to_string(file_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| get_mock_blocks()),
            Err(_) => get_mock_blocks(),
        }
    } else {
        println!("⚠️ No DB found, loading mock genesis block.");
        get_mock_blocks()
    };

    // 2. [EIM] Security Filtering (The "x-ray" filter)
    let filtered_blocks: Vec<Block> = raw_blocks
        .into_iter()
        .filter(|b| check_access(&user, b, "read"))
        .collect();

    println!(
        "🔒 SecureLoad: User {} ({}) requested doc. Returned {} blocks from disk.",
        user.id,
        user.attributes.role,
        filtered_blocks.len()
    );

    filtered_blocks
}

/**
 * [EIM] Save Document to File System
 * Writes the full state to disk after strictly validating security metadata.
 */
#[tauri::command]
fn save_secure_document(blocks: Vec<Block>, user: User) -> bool {
    // 1. Security Check: Only admins/editors can save
    if user.attributes.role != "admin" && user.attributes.role != "editor" {
        println!("❌ Access Denied: User {} cannot save.", user.id);
        return false;
    }

    // 2. Load existing state for "Pre-computation" (Checking locks)
    let file_path = "demo.crng";
    let existing_blocks: Vec<Block> = if std::path::Path::new(file_path).exists() {
        std::fs::read_to_string(file_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_else(Vec::new)
    } else {
        Vec::new()
    };

    // 3. Strict Validation & Integrity Checks
    for block in &blocks {
        // A. UUID Format Validation
        if Uuid::parse_str(&block.id).is_err() {
            // Allow mock IDs from genesis (e.g., "b1", "b2") but log warning
            if !block.id.starts_with('b') || block.id.len() > 3 {
                println!(
                    "❌ Integrity Error: Block {} has invalid UUID format.",
                    block.id
                );
                return false;
            }
        }

        // B. Lock Enforcement
        if let Some(existing) = existing_blocks.iter().find(|eb| eb.id == block.id) {
            if existing.data.metadata.locked.unwrap_or(false) && user.attributes.role != "admin" {
                println!(
                    "❌ Access Denied: Block {} is locked. Only Admins can modify.",
                    block.id
                );
                return false;
            }

            // C. Audit Metadata Changes
            if existing.data.metadata.classification != block.data.metadata.classification {
                audit_log(
                    &user.id,
                    "CHANGE_CLASSIFICATION",
                    &block.id,
                    &format!(
                        "From {:?} to {:?}",
                        existing.data.metadata.classification, block.data.metadata.classification
                    ),
                );
            }
        }
    }

    // 4. Write to Disk
    match serde_json::to_string_pretty(&blocks) {
        Ok(json_content) => {
            if let Err(e) = std::fs::write(file_path, json_content) {
                println!("❌ FileSystem Error: {}", e);
                return false;
            }
        }
        Err(e) => {
            println!("❌ Serialization Error: {}", e);
            return false;
        }
    }

    println!(
        "💾 FileSystem: Saved {} blocks to {}.",
        blocks.len(),
        file_path
    );
    return true;
}

/**
 * [EIM] Reset Document
 * Deletes the persistence file to restore Mock Data.
 */
#[tauri::command]
fn reset_secure_document(user: User) -> bool {
    // Only Admin can reset
    if user.attributes.role != "admin" {
        return false;
    }

    let file_path = "demo.crng";
    if std::path::Path::new(file_path).exists() {
        let _ = std::fs::remove_file(file_path);
        println!("🗑️  Reset: Deleted persistence file.");
    }
    true
}

// Mock Data Generator
fn get_mock_blocks() -> Vec<Block> {
    vec![
        // Block 1: Public Title
        Block {
            id: "b1".to_string(),
            block_type: "heading1".to_string(),
            data: BlockData {
                text: Some("Public Revenue Report".to_string()),
                value: None,
                metadata: Metadata {
                    slide_index: Some(0),
                    layout: Some("full-width".to_string()),
                    acl: None,
                    classification: Some("public".to_string()),
                    provenance: None,
                    locked: Some(false),
                    origin_doc_id: None,
                    origin_url: None,
                },
            },
            created: "2024-01-01".to_string(),
            modified: "2024-01-01".to_string(),
            type_: "heading1".to_string(),
        },
        // Block 2: Internal Summary
        Block {
            id: "b2".to_string(),
            block_type: "paragraph".to_string(),
            data: BlockData {
                text: Some("This is internal data visible to all employees.".to_string()),
                value: None,
                metadata: Metadata {
                    slide_index: Some(0),
                    layout: None,
                    acl: None,
                    classification: Some("internal".to_string()),
                    provenance: None,
                    locked: Some(false),
                    origin_doc_id: None,
                    origin_url: None,
                },
            },
            created: "2024-01-01".to_string(),
            modified: "2024-01-01".to_string(),
            type_: "paragraph".to_string(),
        },
        // Block 3: Confidential Data (Managers Only)
        Block {
            id: "b3".to_string(),
            block_type: "variable".to_string(),
            data: BlockData {
                text: None,
                value: Some(VariableValue {
                    name: "executive_bonus_pool".to_string(),
                    value: serde_json::json!(500000),
                    format: Some("currency".to_string()),
                }),
                metadata: Metadata {
                    slide_index: Some(1),
                    layout: Some("inline".to_string()),
                    acl: None,
                    classification: Some("confidential".to_string()), // Requires L2
                    provenance: Some(Provenance {
                        source_id: "finance-db".to_string(),
                        source_doc_id: None,
                        author_id: "cfo".to_string(),
                        timestamp: "2024-01-01".to_string(),
                        signature: None,
                        origin_url: None,
                    }),
                    locked: Some(true),
                    origin_doc_id: None,
                    origin_url: None,
                },
            },
            created: "2024-01-01".to_string(),
            modified: "2024-01-01".to_string(),
            type_: "variable".to_string(),
        },
        // Block 4: Restricted Data (Admins Only)
        Block {
            id: "b4".to_string(),
            block_type: "paragraph".to_string(),
            data: BlockData {
                text: Some("RESTRICTED: M&A TARGETS".to_string()),
                value: None,
                metadata: Metadata {
                    slide_index: Some(2),
                    layout: None,
                    acl: Some(vec!["admin".to_string()]),
                    classification: Some("restricted".to_string()),
                    provenance: None,
                    locked: Some(false),
                    origin_doc_id: None,
                    origin_url: None,
                },
            },
            created: "2024-01-01".to_string(),
            modified: "2024-01-01".to_string(),
            type_: "paragraph".to_string(),
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::{Emitter, Listener};
            let handle = app.handle().clone();

            // 1. Handle Yjs Updates (Broadcast to all clients)
            app.listen("yjs-update", move |event: tauri::Event| {
                let _ = handle.emit("yjs-update-remote", event.payload());
            });

            let handle_awareness = app.handle().clone();
            // 2. Handle Awareness Updates (Broadcast to all clients)
            app.listen("awareness-update", move |event: tauri::Event| {
                let _ = handle_awareness.emit("awareness-update-remote", event.payload());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            load_secure_document,
            save_secure_document,
            check_block_permission,
            reset_secure_document,
            fetch_external_block,
            request_capability_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_access() {
        let admin = User {
            id: "admin1".to_string(),
            attributes: UserAttributes {
                role: "admin".to_string(),
                department: None,
                clearance_level: Some(5),
            },
        };
        let blocks = get_mock_blocks();

        // Admin should see everything
        for block in blocks {
            assert!(
                check_access(&admin, &block, "read"),
                "Admin should see block {}",
                block.id
            );
        }
    }

    #[test]
    fn test_viewer_access_public() {
        let viewer = User {
            id: "u3".to_string(),
            attributes: UserAttributes {
                role: "viewer".to_string(),
                department: None,
                clearance_level: Some(0),
            },
        };
        let blocks = get_mock_blocks();

        // Block 1 is Public
        assert!(
            check_access(&viewer, &blocks[0], "read"),
            "Viewer should see public block"
        );

        // Block 2 is Internal (Viewer is internal)
        assert!(
            check_access(&viewer, &blocks[1], "read"),
            "Viewer should see internal block"
        );

        // Block 3 is Confidential (Requires Level 2)
        assert!(
            !check_access(&viewer, &blocks[2], "read"),
            "Viewer should NOT see confidential block"
        );

        // Block 4 is Restricted (Requires Level 3 + Admin Role)
        assert!(
            !check_access(&viewer, &blocks[3], "read"),
            "Viewer should NOT see restricted block"
        );
    }

    #[test]
    fn test_manager_access_confidential() {
        let manager = User {
            id: "m1".to_string(),
            attributes: UserAttributes {
                role: "editor".to_string(),
                department: None,
                clearance_level: Some(2), // Sufficient for Confidential
            },
        };
        let blocks = get_mock_blocks();

        // Should see Confidential
        assert!(
            check_access(&manager, &blocks[2], "read"),
            "Manager L2 should see confidential block"
        );

        // Should NOT see Restricted (Level 3 or specific ACL)
        // Block 4 has ACL ["admin"]
        assert!(
            !check_access(&manager, &blocks[3], "read"),
            "Manager L2 should NOT see Admin Only block"
        );
    }

    #[test]
    fn test_write_permission() {
        let viewer = User {
            id: "u3".to_string(),
            attributes: UserAttributes {
                role: "viewer".to_string(),
                department: None,
                clearance_level: Some(0),
            },
        };
        let editor = User {
            id: "u2".to_string(),
            attributes: UserAttributes {
                role: "editor".to_string(),
                department: None,
                clearance_level: Some(1),
            },
        };

        let block = &get_mock_blocks()[0]; // Public block

        assert!(
            !check_access(&viewer, block, "write"),
            "Viewer cannot write"
        );
        assert!(check_access(&editor, block, "write"), "Editor can write");
    }

    #[test]
    fn test_crypto_handshake() {
        // 1. Sign a token
        let token_id = "test-token-123";
        let signature = sign_token(token_id);

        println!("Generated Signature: {}", signature);

        // 2. Verify it
        assert!(
            verify_token(token_id, &signature),
            "Signature should be valid"
        );

        // 3. Verify tampering fails
        assert!(
            !verify_token("tampered-token", &signature),
            "Tampered token should fail"
        );
        assert!(
            !verify_token(token_id, "deadbeef"),
            "Invalid signature hex should fail"
        );
    }
}
