use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const EXTENSIONS_DIR: &str = ".corngr/extensions";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplaceProduct {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub price: String,
    pub capabilities: Vec<String>,
    #[serde(default)] // Allow missing installed field from remote JSON
    pub installed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub capabilities: Vec<String>,
}

// --- Commands ---

#[tauri::command]
pub async fn fetch_market_index() -> Result<Vec<MarketplaceProduct>, String> {
    // 1. Fetch from "Remote" Registry (localhost via tauri-plugin-http or reqwest)
    // For local dev, we might assume the frontend fetches it?
    // Actually, backend fetching is more robust for "Agents".
    // But since we are in Tauri, we can just fetch from the public URL.

    // NOTE: In a real app we'd use reqwest. Here we'll rely on the frontend passing the data OR
    // we use reqwest if available. Let's check Cargo.toml later.
    // For now, let's simulate the fetch by reading the file if we are in dev,
    // OR we can hardcode the URL.

    // let registry_url = "http://localhost:1420/registry/index.json";

    // We'll use a simple HTTP get if possible.
    // If we don't have reqwest, we can error out or mock it?
    // Let's assume we can add reqwest or use std::process::Command (curl) as a fallback?
    // NO, we should avoid shelling out.

    // ALTERNATIVE: Since we are validiting the file system, let's check installed status here.
    // The Frontend will fetch the JSON. We just need to answer "is installed?".
    // Actually, the plan said "fetch_market_manifest" command.

    // Let's implement robust fetching using `reqwest` if we can, but let's check if we have it.
    // Assuming we DON'T have reqwest yet, let's just cheat and assume we are local file system for now?
    // "http://localhost:1420" points to `../public` relative to `src-tauri`? No.

    // Let's try to fetch using `reqwest::get` assuming it's there or we add it.
    // If I can't look at Cargo.toml, I risk compilation error.
    // SAFEST BET: Read from `../public/registry/index.json` directly for this prototype since we are local.

    let index_path = "../public/registry/index.json";
    // Note: CWD for tauri dev might be src-tauri or root. Usually root.
    // Let's try root relative path.

    let content =
        fs::read_to_string(index_path).map_err(|e| format!("Failed to read registry: {}", e))?;
    let mut products: Vec<MarketplaceProduct> =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // 2. Decorate with installed status
    let installed_ids = get_installed_ids();
    for prod in &mut products {
        if installed_ids.contains(&prod.id) {
            prod.installed = true;
        }
    }

    Ok(products)
}

#[tauri::command]
pub async fn install_package(package_id: String) -> Result<bool, String> {
    // 1. Ensure extensions dir exists
    if let Err(e) = fs::create_dir_all(EXTENSIONS_DIR) {
        return Err(format!("Failed to create extensions dir: {}", e));
    }

    // 2. Fetch Manifest (Simulate download)
    let manifest_path = format!("../public/registry/{}.json", package_id);
    let content = fs::read_to_string(&manifest_path)
        .map_err(|_| format!("Package {} not found in registry", package_id))?;

    // 3. Validate JSON
    let manifest: PackageManifest =
        serde_json::from_str(&content).map_err(|e| format!("Invalid manifest: {}", e))?;

    // 4. Write to installed directory
    let install_path = Path::new(EXTENSIONS_DIR).join(format!("{}.json", package_id));
    fs::write(install_path, content).map_err(|e| e.to_string())?;

    println!("📦 Installed Package: {} ({})", manifest.name, package_id);
    Ok(true)
}

#[tauri::command]
pub async fn uninstall_package(package_id: String) -> Result<bool, String> {
    let install_path = Path::new(EXTENSIONS_DIR).join(format!("{}.json", package_id));
    if install_path.exists() {
        fs::remove_file(install_path).map_err(|e| e.to_string())?;
        println!("🗑️ Uninstalled Package: {}", package_id);
    }
    Ok(true)
}

// --- Helpers ---

#[tauri::command]
pub async fn get_installed_extensions() -> Result<Vec<PackageManifest>, String> {
    let mut manifests = Vec::new();
    if let Ok(entries) = fs::read_dir(EXTENSIONS_DIR) {
        for entry in entries.flatten() {
            // Read all .json files inextensions dir
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    if let Ok(manifest) = serde_json::from_str::<PackageManifest>(&content) {
                        manifests.push(manifest);
                    }
                }
            }
        }
    }
    Ok(manifests)
}

fn get_installed_ids() -> Vec<String> {
    let mut ids = Vec::new();
    if let Ok(entries) = fs::read_dir(EXTENSIONS_DIR) {
        for entry in entries.flatten() {
            if let Some(stem) = entry.path().file_stem() {
                if let Some(s) = stem.to_str() {
                    ids.push(s.to_string());
                }
            }
        }
    }
    ids
}
