use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use crate::websocket_server::CollabServer;

/// Global state for the WebSocket server
pub struct CollabServerState {
    pub server: Option<Arc<CollabServer>>,
    pub handle: Option<tokio::task::JoinHandle<()>>,
}

impl CollabServerState {
    pub fn new() -> Self {
        Self {
            server: None,
            handle: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub rooms: usize,
    pub total_clients: usize,
}

/// Start the WebSocket collaboration server
#[tauri::command]
pub async fn start_websocket_server(
    port: u16,
    state: tauri::State<'_, Arc<RwLock<CollabServerState>>>,
) -> Result<String, String> {
    let mut server_state = state.write().await;

    // Check if already running
    if server_state.server.is_some() {
        return Err("WebSocket server is already running".to_string());
    }

    println!("🚀 Starting WebSocket server on port {}...", port);

    let server = Arc::new(CollabServer::new(port));
    let server_clone = Arc::clone(&server);

    // Spawn server task
    let handle = tokio::spawn(async move {
        if let Err(e) = server_clone.start().await {
            eprintln!("❌ WebSocket server error: {}", e);
        }
    });

    server_state.server = Some(server);
    server_state.handle = Some(handle);

    Ok(format!("WebSocket server started on port {}", port))
}

/// Stop the WebSocket collaboration server
#[tauri::command]
pub async fn stop_websocket_server(
    state: tauri::State<'_, Arc<RwLock<CollabServerState>>>,
) -> Result<String, String> {
    let mut server_state = state.write().await;

    if let Some(handle) = server_state.handle.take() {
        handle.abort();
        server_state.server = None;
        println!("🛑 WebSocket server stopped");
        Ok("WebSocket server stopped".to_string())
    } else {
        Err("WebSocket server is not running".to_string())
    }
}

/// Get WebSocket server status
#[tauri::command]
pub async fn get_server_status(
    state: tauri::State<'_, Arc<RwLock<CollabServerState>>>,
) -> Result<ServerStatus, String> {
    let server_state = state.read().await;

    if let Some(server) = &server_state.server {
        let stats = server.get_stats().await;
        
        Ok(ServerStatus {
            running: true,
            port: Some(3030), // TODO: Store port in state
            rooms: stats.get("total_rooms").copied().unwrap_or(0),
            total_clients: stats.get("total_clients").copied().unwrap_or(0),
        })
    } else {
        Ok(ServerStatus {
            running: false,
            port: None,
            rooms: 0,
            total_clients: 0,
        })
    }
}

/// List active rooms (for debugging)
#[tauri::command]
pub async fn list_active_rooms(
    state: tauri::State<'_, Arc<RwLock<CollabServerState>>>,
) -> Result<Vec<String>, String> {
    let server_state = state.read().await;

    if let Some(_server) = &server_state.server {
        // TODO: Add method to get room names from CollabServer
        Ok(vec!["Not implemented yet".to_string()])
    } else {
        Err("WebSocket server is not running".to_string())
    }
}
