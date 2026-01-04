use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::fs;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio_tungstenite::{
    accept_hdr_async,
    tungstenite::handshake::server::{Request, Response},
    tungstenite::Message,
};
use y_sync::sync::{Message as YSyncMessage, SyncMessage};
use yrs::updates::decoder::{Decode, DecoderV1};
use yrs::updates::encoder::Encode;
use yrs::{Doc, ReadTxn, StateVector, Transact};

const STORAGE_DIR: &str = ".corngr/storage";

/// A room contains a shared Yjs document and all connected clients
pub struct Room {
    pub name: String,
    pub doc: Doc,
    pub clients: Vec<ClientConnection>,
}

impl Room {
    fn new(name: String) -> Self {
        let doc = Doc::new();
        // Try to load existing data
        if let Ok(data) = load_snapshot(&name) {
            println!(
                "💾 Loaded snapshot for room '{}' ({} bytes)",
                name,
                data.len()
            );
            let mut txn = doc.transact_mut();
            match yrs::Update::decode_v1(&data) {
                Ok(update) => {
                    txn.apply_update(update);
                }
                Err(e) => {
                    eprintln!("❌ Failed to decode snapshot for room '{}': {}", name, e);
                }
            }
        }
        Self {
            name,
            doc,
            clients: Vec::new(),
        }
    }

    fn save(&self) {
        let txn = self.doc.transact();
        let state_vector = StateVector::default(); // Full state
        let update = txn.encode_state_as_update_v1(&state_vector);
        if let Err(e) = save_snapshot(&self.name, &update) {
            eprintln!("❌ Failed to save snapshot for room '{}': {}", self.name, e);
        }
    }
}

/// Represents a connected WebSocket client
pub struct ClientConnection {
    pub client_id: u64,
    pub user_id: String,
    pub user_role: String, // "editor", "auditor", "viewer"
    pub tx: tokio::sync::mpsc::UnboundedSender<Message>,
}

/// The collaboration server manages multiple rooms (documents)
pub struct CollabServer {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
    port: u16,
}

impl CollabServer {
    pub fn new(port: u16) -> Self {
        // Ensure storage directory exists
        if let Err(e) = fs::create_dir_all(STORAGE_DIR) {
            eprintln!("❌ Failed to create storage directory: {}", e);
        } else {
            println!("📂 Storage directory ready: {}", STORAGE_DIR);
        }

        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            port,
        }
    }

    /// Start the WebSocket server
    pub async fn start(self: Arc<Self>) -> Result<(), Box<dyn std::error::Error>> {
        let addr: SocketAddr = format!("127.0.0.1:{}", self.port).parse()?;
        let listener = TcpListener::bind(&addr).await?;

        println!("🚀 Collaboration WebSocket server listening on: {}", addr);

        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    let server = Arc::clone(&self);
                    tokio::spawn(async move {
                        if let Err(e) = server.handle_connection(stream, addr).await {
                            eprintln!("❌ Error handling connection from {}: {}", addr, e);
                        }
                    });
                }
                Err(e) => {
                    eprintln!("❌ Error accepting connection: {}", e);
                }
            }
        }
    }

    /// Handle a new WebSocket connection
    async fn handle_connection(
        &self,
        stream: TcpStream,
        addr: SocketAddr,
    ) -> Result<(), Box<dyn std::error::Error>> {
        println!("✅ New connection from: {}", addr);

        // Extract room name and user info from HTTP request during WebSocket handshake
        let room_name_arc = Arc::new(std::sync::Mutex::new("default".to_string()));
        let user_info_arc = Arc::new(std::sync::Mutex::new((
            "anonymous".to_string(),
            "viewer".to_string(),
        )));

        let room_name_clone = Arc::clone(&room_name_arc);
        let user_info_clone = Arc::clone(&user_info_arc);

        let ws_stream = accept_hdr_async(stream, move |req: &Request, response: Response| {
            let uri = req.uri();
            let path = uri.path();
            let query = uri.query().unwrap_or("");

            // Extract room name from path
            let extracted_room = path
                .trim_start_matches('/')
                .split('?')
                .next()
                .unwrap_or("default");

            let mut room_guard = room_name_clone.lock().unwrap();
            if !extracted_room.is_empty() {
                *room_guard = extracted_room.to_string();
            } else {
                println!("⚠️  No room in URL path, using 'default'");
            }
            drop(room_guard);

            // Extract user authentication from query parameters
            // Format: "?userId=user123&userRole=editor"
            let mut user_id = "anonymous".to_string();
            let mut user_role = "viewer".to_string(); // Default to most restrictive

            // Parse query string
            for param in query.split('&') {
                if let Some((key, value)) = param.split_once('=') {
                    match key {
                        "userId" => {
                            user_id = urlencoding::decode(value)
                                .unwrap_or_else(|_| value.into())
                                .to_string();
                        }
                        "userRole" => {
                            let role = urlencoding::decode(value)
                                .unwrap_or_else(|_| value.into())
                                .to_string();
                            // Validate role
                            if role == "editor" || role == "auditor" || role == "viewer" {
                                user_role = role;
                            } else {
                                println!("⚠️  Invalid role '{}', defaulting to 'viewer'", role);
                            }
                        }
                        _ => {}
                    }
                }
            }

            let mut user_info_guard = user_info_clone.lock().unwrap();
            *user_info_guard = (user_id.clone(), user_role.clone());
            drop(user_info_guard);

            println!(
                "🔐 WebSocket auth: User '{}' with role '{}'",
                user_id, user_role
            );

            Ok(response)
        })
        .await?;

        let room_name = room_name_arc.lock().unwrap().clone();
        let (user_id, user_role) = user_info_arc.lock().unwrap().clone();

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
        let client_id = rand::random::<u64>();

        let sync_message = self
            .add_client_to_room(
                &room_name,
                client_id,
                user_id.clone(),
                user_role.clone(),
                tx.clone(),
            )
            .await?;

        if let Some(msg) = sync_message {
            let _ = tx.send(Message::Binary(msg));
        }

        let mut send_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if ws_sender.send(msg).await.is_err() {
                    break;
                }
            }
        });

        // Loop: Receive messages
        loop {
            tokio::select! {
                msg = ws_receiver.next() => {
                    match msg {
                        Some(Ok(Message::Binary(data))) => {
                            // IRAP COMPLIANCE: Role-based access control
                            // Decode message to check if it's an update
                            let mut decoder = DecoderV1::from(data.as_slice());
                            let is_update = matches!(
                                YSyncMessage::decode(&mut decoder),
                                Ok(YSyncMessage::Sync(SyncMessage::Update(_)))
                            );

                            // Check if user has write permission
                            if is_update && (user_role == "auditor" || user_role == "viewer") {
                                eprintln!(
                                    "❌ WRITE REJECTED: User '{}' with role '{}' attempted to modify document '{}'",
                                    user_id, user_role, room_name
                                );

                                // Send error message to client
                                let error_msg = format!(
                                    "ERROR: Access Denied - Role '{}' has read-only access",
                                    user_role
                                );
                                let _ = tx.send(Message::Text(error_msg));

                                // TODO: Add audit log entry
                                println!(
                                    "🛡️  AUDIT: User '{}' ({}) - WRITE_REJECTED on room '{}'",
                                    user_id, user_role, room_name
                                );

                                continue;  // Skip broadcasting and applying this update
                            }

                            // 1. Broadcast to others (raw protocol message)
                            if let Err(e) = self.broadcast_to_room(
                                &room_name,
                                data.clone(),
                                client_id,
                            ).await {
                                eprintln!("❌ Error broadcasting message: {}", e);
                            }

                            // 2. Snoop on updates to save to disk.
                            // We construct a DecoderV1 from the byte slice.
                            // Note: DecoderV1::from(&[u8]) is available in yrs 0.17+
                            let mut decoder = DecoderV1::from(data.as_slice());
                            match YSyncMessage::decode(&mut decoder) {
                                Ok(y_msg) => {
                                    match y_msg {
                                        YSyncMessage::Sync(SyncMessage::Update(update_data)) => {
                                            // This is an update! Apply to server doc.
                                            if let Err(e) = self.apply_update_to_room(&room_name, &update_data).await {
                                                eprintln!("❌ Error applying update: {}", e);
                                            } else {
                                                // Log successful update
                                                println!(
                                                    "🛡️  AUDIT: User '{}' ({}) - BLOCK_UPDATE on room '{}'",
                                                    user_id, user_role, room_name
                                                );
                                            }
                                        }
                                        _ => {} // Ignore Auth, Awareness, etc.
                                    }
                                }
                                Err(_) => {
                                    // It might be a raw update or something else, but if it's protocol we catch it.
                                    // If decode fails, we do nothing (we already broadcasted raw data).
                                }
                            }
                        }
                        Some(Ok(Message::Close(_))) | None => {
                            println!("👋 Client {} disconnected", addr);
                            break;
                        }
                        Some(Err(e)) => {
                            eprintln!("❌ WebSocket error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }
                _ = &mut send_task => {
                    println!("📤 Send task ended for client {}", addr);
                    break;
                }
            }
        }

        self.remove_client_from_room(&room_name, client_id).await;

        Ok(())
    }

    /// Add a client to a room and return initial sync message
    async fn add_client_to_room(
        &self,
        room_name: &str,
        client_id: u64,
        user_id: String,
        user_role: String,
        tx: tokio::sync::mpsc::UnboundedSender<Message>,
    ) -> Result<Option<Vec<u8>>, Box<dyn std::error::Error>> {
        let mut rooms = self.rooms.write().await;
        let room = rooms
            .entry(room_name.to_string())
            .or_insert_with(|| Room::new(room_name.to_string()));

        room.clients.push(ClientConnection {
            client_id,
            user_id: user_id.clone(),
            user_role: user_role.clone(),
            tx,
        });

        // Generate Sync Step containing valid protocol Message
        let txn = room.doc.transact();
        let state_vector = txn.state_vector();
        let update = txn.encode_diff_v1(&state_vector);

        println!(
            "📥 Client {} (User: '{}', Role: '{}') joined room '{}' ({} clients)",
            client_id,
            user_id,
            user_role,
            room_name,
            room.clients.len()
        );

        // Audit log the connection
        println!(
            "🛡️  AUDIT: User '{}' ({}) - CONNECTION_ESTABLISHED to room '{}'",
            user_id, user_role, room_name
        );

        if !update.is_empty() {
            // Wrap update in Protocol Message so client understands it
            let msg = SyncMessage::Update(update).encode_v1();
            Ok(Some(msg))
        } else {
            Ok(None)
        }
    }

    /// Broadcast a message to all clients in a room except sender
    async fn broadcast_to_room(
        &self,
        room_name: &str,
        data: Vec<u8>,
        sender_id: u64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let rooms = self.rooms.read().await;

        if let Some(room) = rooms.get(room_name) {
            let msg = Message::Binary(data);

            for client in &room.clients {
                if client.client_id != sender_id {
                    let _ = client.tx.send(msg.clone());
                }
            }
        }

        Ok(())
    }

    /// Apply an update to the room's document
    async fn apply_update_to_room(
        &self,
        room_name: &str,
        update: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut rooms = self.rooms.write().await;

        if let Some(room) = rooms.get_mut(room_name) {
            let mut txn = room.doc.transact_mut();
            txn.apply_update(yrs::Update::decode_v1(update)?);

            drop(txn);
            room.save();
        }

        Ok(())
    }

    /// Remove a client from a room
    async fn remove_client_from_room(&self, room_name: &str, client_id: u64) {
        let mut rooms = self.rooms.write().await;

        if let Some(room) = rooms.get_mut(room_name) {
            room.clients.retain(|c| c.client_id != client_id);

            println!(
                "👋 Client {} left room '{}' ({} clients remaining)",
                client_id,
                room_name,
                room.clients.len()
            );

            if room.clients.is_empty() {
                rooms.remove(room_name);
                println!("🗑️  Room '{}' unloaded (no clients)", room_name);
            }
        }
    }

    /// Get server statistics
    pub async fn get_stats(&self) -> HashMap<String, usize> {
        let rooms = self.rooms.read().await;
        let mut stats = HashMap::new();

        stats.insert("total_rooms".to_string(), rooms.len());
        stats.insert(
            "total_clients".to_string(),
            rooms.values().map(|r| r.clients.len()).sum(),
        );

        stats
    }
}

// --- Persistence Helpers ---

fn save_snapshot(room_name: &str, data: &[u8]) -> std::io::Result<()> {
    let path = Path::new(STORAGE_DIR).join(format!("{}.bin", room_name));
    fs::write(path, data)
}

fn load_snapshot(room_name: &str) -> std::io::Result<Vec<u8>> {
    let path = Path::new(STORAGE_DIR).join(format!("{}.bin", room_name));
    fs::read(path)
}
