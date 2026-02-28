use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

// WebSocket Collaboration Modules
pub mod audit;
pub mod marketplace;
pub mod security;
pub mod tauri_commands;
pub mod websocket_server;

// ERP Engine (Phase A Milestone 1 + 2)
pub mod erp;

// [Phase 5] Token Revocation System
lazy_static::lazy_static! {
    static ref REVOKED_TOKENS: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
}

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
pub struct BlockSignatureRequest {
    pub block_id: String,
    pub content_hash: String, // SHA-256 of block content
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlockSignature {
    pub signature: String, // Hex-encoded Ed25519 signature
    pub signer_id: String, // Public key fingerprint
    pub timestamp: String, // RFC3339
    pub algorithm: String, // "Ed25519"
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
            // Parse token format: "token_id:signature:expires_at"
            // This allows us to check both signature AND expiration
            let parts: Vec<&str> = token_str.split(':').collect();
            if parts.len() >= 3 {
                let capability_token = CapabilityToken {
                    token_id: parts[0].to_string(),
                    signature: parts[1].to_string(),
                    expires_at: parts[2].to_string(),
                };

                if verify_token_with_expiration(&capability_token) {
                    println!(
                        "✅ CRYPTO PROOF: Valid Token {} (expires: {})",
                        capability_token.token_id, capability_token.expires_at
                    );
                    // Fast-path allow!
                    block.data.metadata.origin_doc_id = Some(doc_id);
                    block.data.metadata.origin_url = Some(origin_url);
                    return Ok(block);
                } else {
                    println!("❌ CRYPTO FAIL: Invalid or Expired Token");
                }
            } else {
                // Fallback to old format for backwards compatibility
                if let Some((t_id, sig)) = token_str.split_once(':') {
                    if verify_token(t_id, sig) {
                        println!(
                            "⚠️ LEGACY TOKEN: Valid Signature but no expiration check for {}",
                            t_id
                        );
                        block.data.metadata.origin_doc_id = Some(doc_id);
                        block.data.metadata.origin_url = Some(origin_url);
                        return Ok(block);
                    }
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

/**
 * [Phase 5] Revoke Capability Token
 * Invalidates a token immediately, preventing further use.
 */
#[tauri::command]
fn revoke_capability_token(token_id: String) -> bool {
    let mut revoked = REVOKED_TOKENS.lock().unwrap();
    revoked.insert(token_id.clone());
    println!("🚫 Token {} revoked", token_id);
    true
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

#[tauri::command]
fn sign_block(req: BlockSignatureRequest, user: User) -> Result<BlockSignature, String> {
    // Only editors/admins can sign
    if user.attributes.role == "viewer" || user.attributes.role == "auditor" {
        return Err("Access Denied: Read-only users cannot sign blocks".into());
    }

    let signing_key = KeyManager::get_signing_key();
    let public_key = signing_key.verifying_key();

    // Sign the content: "block_id:content_hash"
    // This binds the signature to both the specific block instance and its content
    let message = format!("{}:{}", req.block_id, req.content_hash);
    let signature: Signature = signing_key.sign(message.as_bytes());

    // Generate signer ID (first 16 chars of public key hex)
    let signer_id = hex::encode(public_key.to_bytes())[..16].to_string();

    let result = BlockSignature {
        signature: hex::encode(signature.to_bytes()),
        signer_id,
        timestamp: chrono::Utc::now().to_rfc3339(),
        algorithm: "Ed25519".to_string(),
    };

    // Audit log the signing event
    audit_log(
        &user.id,
        "BLOCK_SIGNED",
        &req.block_id,
        "Ed25519 Signature Generated",
    );

    Ok(result)
}

#[tauri::command]
fn get_audit_log(limit: Option<usize>) -> Result<Vec<audit::AuditEvent>, String> {
    audit::read_log(limit.unwrap_or(100)).map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_block_signature(
    block_id: String,
    content_hash: String,
    signature_hex: String,
) -> Result<bool, String> {
    let public_key = KeyManager::get_public_key();
    let message = format!("{}:{}", block_id, content_hash);

    if let Ok(sig_bytes) = hex::decode(&signature_hex) {
        if let Ok(byte_array) = sig_bytes.try_into() {
            let signature = Signature::from_bytes(&byte_array);
            return Ok(public_key.verify(message.as_bytes(), &signature).is_ok());
        }
    }
    Ok(false)
}

/**
 * [Phase 5] Check if token is revoked
 */
fn is_token_revoked(token_id: &str) -> bool {
    let revoked = REVOKED_TOKENS.lock().unwrap();
    revoked.contains(token_id)
}

/**
 * [Phase 4] Real Ed25519 Verification with Expiration Check
 * [Phase 5] Added revocation check
 */
fn verify_token_with_expiration(token: &CapabilityToken) -> bool {
    let public_key = KeyManager::get_public_key();

    // 0. Check revocation
    if is_token_revoked(&token.token_id) {
        println!("❌ Token {} has been revoked", token.token_id);
        return false;
    }

    // 1. Check expiration
    if let Ok(expires_at) = chrono::DateTime::parse_from_rfc3339(&token.expires_at) {
        if expires_at.timestamp() < chrono::Utc::now().timestamp() {
            println!(
                "❌ Token {} expired at {}",
                token.token_id, token.expires_at
            );
            return false;
        }
    } else {
        println!("❌ Invalid expiration format for token {}", token.token_id);
        return false;
    }

    // 2. Verify signature
    if let Ok(sig_bytes) = hex::decode(&token.signature) {
        if let Ok(byte_array) = sig_bytes.try_into() {
            let signature = Signature::from_bytes(&byte_array);
            return public_key
                .verify(token.token_id.as_bytes(), &signature)
                .is_ok();
        }
    }
    false
}

/**
 * [Phase 4] Legacy signature-only verification (for backwards compatibility)
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
    audit::log_event(audit::AuditEvent::new(
        user_id,
        action,
        resource_id,
        detail,
        "INFO",
    ));
}

/**
 * [EIM] List Documents
 * Returns a list of available .crng files in the current directory.
 */
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentInfo {
    pub id: String,
    pub filename: String,
    pub modified: String,
}

// [Removed duplicate legacy implementations]

use tauri::Manager; // Ensure Manager is imported

#[tauri::command]
fn list_documents(app: tauri::AppHandle) -> Vec<DocumentInfo> {
    let mut docs = Vec::new();
    let docs_dir = match app.path().app_local_data_dir() {
        Ok(path) => path,
        Err(_) => return docs, // Return empty if path fails
    };

    if let Ok(entries) = fs::read_dir(&docs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("crng") {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    let id = file_name.replace(".crng", "");
                    let modified = if let Ok(metadata) = fs::metadata(&path) {
                        if let Ok(time) = metadata.modified() {
                            let datetime: chrono::DateTime<chrono::Utc> = time.into();
                            datetime.to_rfc3339()
                        } else {
                            String::new()
                        }
                    } else {
                        String::new()
                    };

                    docs.push(DocumentInfo {
                        id,
                        filename: file_name.to_string(),
                        modified,
                    });
                }
            }
        }
    }
    docs
}

#[tauri::command]
fn load_secure_document(app: tauri::AppHandle, user: User, doc_id: String) -> Vec<Block> {
    let clean_id = doc_id.replace("/", "").replace("\\", "").replace("..", "");

    let path = match app.path().app_local_data_dir() {
        Ok(mut p) => {
            p.push(format!("{}.crng", clean_id));
            p
        }
        Err(e) => {
            println!("❌ Path Error: {}", e);
            return Vec::new();
        }
    };

    let raw_blocks: Vec<Block> = if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| get_mock_blocks()),
            Err(_) => get_mock_blocks(),
        }
    } else {
        println!(
            "⚠️ Document {} not found at {:?}, loading new/mock.",
            clean_id, path
        );
        if clean_id == "demo" || clean_id == "doc_default" {
            get_mock_blocks()
        } else {
            Vec::new()
        }
    };

    let filtered_blocks: Vec<Block> = raw_blocks
        .into_iter()
        .filter(|b| check_access(&user, b, "read"))
        .collect();

    println!(
        "🔒 SecureLoad: User {} requested doc {}. Returned {} blocks.",
        user.id,
        clean_id,
        filtered_blocks.len()
    );

    filtered_blocks
}

#[tauri::command]
fn save_secure_document(
    app: tauri::AppHandle,
    blocks: Vec<Block>,
    user: User,
    doc_id: String,
) -> bool {
    if user.attributes.role != "admin" && user.attributes.role != "editor" {
        return false;
    }

    let clean_id = doc_id.replace("/", "").replace("\\", "").replace("..", "");

    let dir = match app.path().app_local_data_dir() {
        Ok(p) => p,
        Err(e) => {
            println!("❌ Path Error: {}", e);
            return false;
        }
    };

    // Ensure directory exists
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }

    let path = dir.join(format!("{}.crng", clean_id));

    // Load existing for lock checks (simplified for brevity, assume lock logic is same)
    let existing_blocks: Vec<Block> = if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_else(Vec::new)
    } else {
        Vec::new()
    };

    // ... (Lock checks omitted for brevity but should be here. Assuming passed for now to fix persistence first)
    // Re-implementing minimal lock check to ensure safety:
    for block in &blocks {
        if let Some(existing) = existing_blocks.iter().find(|eb| eb.id == block.id) {
            if existing.data.metadata.locked.unwrap_or(false) && user.attributes.role != "admin" {
                println!("❌ Block {} is locked.", block.id);
                return false;
            }
        }
    }

    match serde_json::to_string_pretty(&blocks) {
        Ok(json_content) => {
            if let Err(e) = std::fs::write(&path, json_content) {
                println!("❌ FileSystem Error: {}", e);
                return false;
            }
        }
        Err(e) => {
            println!("❌ Serialization Error: {}", e);
            return false;
        }
    }

    println!("💾 Saved {} blocks to {:?}.", blocks.len(), path);
    true
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
    use std::sync::Arc;
    use tokio::sync::RwLock;

    // Initialize WebSocket server state
    let server_state = Arc::new(RwLock::new(tauri_commands::CollabServerState::new()));

    tauri::Builder::default()
        // .plugin(tauri_plugin_opener::init()) // potentially causing crash
        .manage(server_state.clone())
        .setup(move |app| {
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

            // 3. Auto-start WebSocket collaboration server
            let server_state_clone = server_state.clone();
            tauri::async_runtime::spawn(async move {
                println!("🚀 Auto-starting WebSocket collaboration server...");
                let server = Arc::new(websocket_server::CollabServer::new(3030));
                let server_clone = Arc::clone(&server);

                let mut state_lock = server_state_clone.write().await;
                state_lock.server = Some(server);
                drop(state_lock);

                if let Err(e) = server_clone.start().await {
                    eprintln!("❌ WebSocket server error: {}", e);
                }
            });

            // 4. Initialise ERP SQLite store (Phase B M10)
            // Resolve platform app-data dir then open/warm corngr.db
            {
                use tauri::Manager;
                let app_data_dir = app
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                let db_path = app_data_dir.join("corngr.db");
                crate::erp::engine::init_erp_db(&db_path);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            check_block_permission,
            load_secure_document,
            save_secure_document,
            reset_secure_document,
            fetch_external_block,
            request_capability_token,
            revoke_capability_token,
            sign_block,
            verify_block_signature,
            get_audit_log,
            list_documents,
            marketplace::fetch_market_index,
            marketplace::install_package,
            marketplace::uninstall_package,
            marketplace::get_installed_extensions,
            // WebSocket collaboration commands
            tauri_commands::start_websocket_server,
            tauri_commands::stop_websocket_server,
            tauri_commands::get_server_status,
            tauri_commands::list_active_rooms,
            // ERP Engine commands (Phase A M1+M2)
            erp::tauri_api::erp_create_tx,
            erp::tauri_api::erp_add_line,
            erp::tauri_api::erp_create_invmove,
            erp::tauri_api::erp_generate_postings,
            erp::tauri_api::erp_post_tx,
            erp::tauri_api::erp_get_tx_snapshot,
            erp::tauri_api::erp_verify_audit_chain,
            // ERP Audit Explorer commands (Phase A M4)
            erp::tauri_api::erp_get_audit_log,
            erp::tauri_api::erp_time_travel,
            // ERP CoA + Ledger commands (Phase A M5)
            erp::tauri_api::erp_seed_coa,
            erp::tauri_api::erp_list_coa,
            erp::tauri_api::erp_get_ledger_summary,
            // ERP Shatter Import command (Phase A M6)
            erp::tauri_api::erp_bulk_import,
            // ERP Post Ceremony command (Phase A M7)
            erp::tauri_api::erp_transition_status,
            // ERP list transactions (Phase A M8)
            erp::tauri_api::erp_list_txs,
            // ERP party master (Phase A M9)
            erp::tauri_api::erp_create_party,
            erp::tauri_api::erp_list_parties,
            // ERP Binary Parquet export (Phase B M11)
            erp::tauri_api::erp_export_parquet,
            erp::tauri_api::erp_export_postings_parquet,
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

    #[test]
    fn test_block_signature_flow() {
        // 1. Setup User and Request
        let editor = User {
            id: "editor-1".to_string(),
            attributes: UserAttributes {
                role: "editor".to_string(),
                department: None,
                clearance_level: None,
            },
        };

        let req = BlockSignatureRequest {
            block_id: "block-123".to_string(),
            content_hash: "hash-of-content".to_string(),
        };

        // 2. Sign Block
        let result = sign_block(req.clone(), editor.clone()).expect("Signing should succeed");

        println!("📝 Block Signature: {:?}", result);
        assert_eq!(result.algorithm, "Ed25519");
        assert!(
            result.signature.len() > 64,
            "Signature should be substantial hex string"
        );

        // 3. Verify Valid Signature
        let is_valid = verify_block_signature(
            req.block_id.clone(),
            req.content_hash.clone(),
            result.signature.clone(),
        )
        .expect("Verification should run");

        assert!(is_valid, "Signature should be valid for original content");

        // 4. Verify Invalid Content (Tampering)
        let is_valid_tampered = verify_block_signature(
            req.block_id.clone(),
            "different-hash".to_string(),
            result.signature.clone(),
        )
        .expect("Verification should run");

        assert!(
            !is_valid_tampered,
            "Signature should FAIL for tampered content"
        );

        // 5. Verify Read-Only Rejection
        let viewer = User {
            id: "viewer-1".to_string(),
            attributes: UserAttributes {
                role: "viewer".to_string(),
                department: None,
                clearance_level: None,
            },
        };

        let err = sign_block(req, viewer).unwrap_err();
        assert!(
            err.contains("Access Denied"),
            "Viewer should not be able to sign"
        );
    }
    #[test]
    fn test_get_audit_log() {
        // 1. Log an Event
        let event = audit::AuditEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
            user_id: "test-user".to_string(),
            action: "TEST_LOG".to_string(),
            resource_id: "test-res".to_string(),
            details: "Testing audit log read".to_string(),
            severity: "INFO".to_string(),
            prev_hash: None,
            hash: None,
        };
        audit::log_event(event);

        // 2. Read Log
        let logs = get_audit_log(Some(10)).expect("Reading log should work");

        // 3. Verify
        assert!(logs.len() > 0, "Should have logs");
        let found = logs.iter().any(|l| l.action == "TEST_LOG");
        assert!(found, "Should find the logged test event");

        println!("✅ Verified Audit Log Read: Found {} entries", logs.len());
    }
}
