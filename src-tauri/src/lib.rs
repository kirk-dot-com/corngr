use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ==========================================
// [EIM] Schema Definitions (Mirroring TS)
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Provenance {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "authorId")]
    pub author_id: String,
    pub timestamp: String,
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
 * Writes the full state to disk.
 */
#[tauri::command]
fn save_secure_document(blocks: Vec<Block>, user: User) -> bool {
    // 1. Security Check: Only admins/editors can save
    if user.attributes.role != "admin" && user.attributes.role != "editor" {
        println!("❌ Access Denied: User {} cannot save.", user.id);
        return false;
    }

    // 2. Write to Disk
    // In a real app we would merge changes. Here we overwrite.
    let file_path = "demo.crng";
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
        .invoke_handler(tauri::generate_handler![
            greet,
            load_secure_document,
            save_secure_document,
            check_block_permission
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
}
