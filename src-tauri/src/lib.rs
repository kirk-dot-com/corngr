use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ==========================================
// [EIM] Schema Definitions (Mirroring TS)
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Provenance {
    pub source_id: String,
    pub author_id: String,
    pub timestamp: String,
    pub signature: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Metadata {
    pub slide_index: Option<i32>,
    pub layout: Option<String>,
    pub acl: Option<Vec<String>>, // Specific user/role IDs allowed to see this
    pub classification: Option<String>, // public, internal, confidential
    pub provenance: Option<Provenance>,
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
    pub role: String, // admin, editor, viewer
    pub department: Option<String>,
    pub clearance_level: i32,
}

// ==========================================
// [EIM] Security Logic (ABAC)
// ==========================================

fn can_view_block(user: &User, block: &Block) -> bool {
    // 1. Admin Override
    if user.role == "admin" {
        return true;
    }

    let meta = &block.data.metadata;

    // 2. ACL Check (Role-Based)
    if let Some(acl) = &meta.acl {
        if !acl.is_empty() && !acl.contains(&user.role) && !acl.contains(&user.id) {
            return false;
        }
    }

    // 3. Classification Check (Attribute-Based)
    if let Some(classification) = &meta.classification {
        match classification.as_str() {
            "public" => true,
            "internal" => true, // Assuming all logged-in users are internal
            "confidential" => user.clearance_level >= 2,
            "restricted" => user.clearance_level >= 3,
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

/**
 * [EIM] Load Secure Document
 * Simulates loading from disk and filtering based on User Context.
 * In a real app, this would read from SQLite/.crng file.
 */
#[tauri::command]
fn load_secure_document(user: User) -> Vec<Block> {
    // 1. Mock Database Load (The "Server Truth")
    let raw_blocks = get_mock_blocks();

    // 2. [EIM] Security Filtering (The "x-ray" filter)
    let filtered_blocks: Vec<Block> = raw_blocks
        .into_iter()
        .filter(|b| can_view_block(&user, b))
        .collect();

    println!(
        "🔒 SecureLoad: User {} ({}) requested doc. Returned {}/{} blocks.",
        user.id, user.role, filtered_blocks.len(), 4
    );

    filtered_blocks
}

/**
 * [EIM] Save Document to File System
 * Writes the full state to disk (simulated).
 * In production this writes to a .crng file.
 */
#[tauri::command]
fn save_secure_document(blocks: Vec<Block>, user: User) -> bool {
    // 1. Security Check: Only admins/editors can save
    if user.role != "admin" && user.role != "editor" {
        println!("❌ Access Denied: User {} cannot save.", user.id);
        return false;
    }

    // 2. Write to Disk (Simulated)
    // std::fs::write("demo.crng", serde_json::to_string(&blocks).unwrap()).unwrap();
    
    println!("💾 FileSystem: Saved {} blocks to disk.", blocks.len());
    return true;
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
                        author_id: "cfo".to_string(),
                        timestamp: "2024-01-01".to_string(),
                        signature: None,
                    }),
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
        .invoke_handler(tauri::generate_handler![greet, load_secure_document])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
