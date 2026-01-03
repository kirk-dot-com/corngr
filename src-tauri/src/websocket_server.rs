use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::fs;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock; // Used for rooms
use tokio_tungstenite::{
    accept_hdr_async,
    tungstenite::handshake::server::{Request, Response},
    tungstenite::Message,
};
use yrs::updates::decoder::Decode;
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

        // Extract room name from HTTP request path during WebSocket handshake
        // use std::sync::Mutex to allow locking inside synchronous closure
        let room_name_arc = Arc::new(std::sync::Mutex::new("default".to_string()));
        let room_name_clone = Arc::clone(&room_name_arc);

        let ws_stream = accept_hdr_async(stream, move |req: &Request, response: Response| {
            // Extract room name from URL path
            // y-websocket connects to ws://host:port/roomname
            let path = req.uri().path();
            let extracted_room = path.trim_start_matches('/');

            let mut room_guard = room_name_clone.lock().unwrap();
            if !extracted_room.is_empty() {
                *room_guard = extracted_room.to_string();
            } else {
                println!("⚠️  No room in URL path, using 'default'");
            }
            drop(room_guard);

            Ok(response)
        })
        .await?;

        let room_name = room_name_arc.lock().unwrap().clone();

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Channel for sending messages to this client
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
        let client_id = rand::random::<u64>();

        // Add client to room and get initial sync message
        let sync_message = self
            .add_client_to_room(&room_name, client_id, tx.clone())
            .await?;

        // Send initial sync to client
        if let Some(msg) = sync_message {
            let _ = tx.send(Message::Binary(msg));
        }

        // Spawn task to forward messages from tx channel to WebSocket
        let mut send_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if ws_sender.send(msg).await.is_err() {
                    break;
                }
            }
        });

        // Process incoming messages
        loop {
            tokio::select! {
                msg = ws_receiver.next() => {
                    match msg {
                        Some(Ok(Message::Binary(data))) => {
                            // Broadcast binary message to all other clients in room
                            if let Err(e) = self.broadcast_to_room(
                                &room_name,
                                data.clone(),
                                client_id,
                            ).await {
                                eprintln!("❌ Error broadcasting message: {}", e);
                            }

                            // Also apply update to server's document and save
                            if let Err(e) = self.apply_update_to_room(&room_name, &data).await {
                                eprintln!("❌ Error applying update: {}", e);
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

        // Clean up: Remove client from room
        self.remove_client_from_room(&room_name, client_id).await;

        Ok(())
    }

    /// Add a client to a room and return initial sync message
    async fn add_client_to_room(
        &self,
        room_name: &str,
        client_id: u64,
        tx: tokio::sync::mpsc::UnboundedSender<Message>,
    ) -> Result<Option<Vec<u8>>, Box<dyn std::error::Error>> {
        let mut rooms = self.rooms.write().await;

        // Get or create room
        let room = rooms
            .entry(room_name.to_string())
            .or_insert_with(|| Room::new(room_name.to_string()));

        // Add client to room
        room.clients.push(ClientConnection { client_id, tx });

        // Get current document state for initial sync
        let txn = room.doc.transact();
        let state_vector = txn.state_vector();
        let update = txn.encode_diff_v1(&state_vector);

        println!(
            "📥 Client {} joined room '{}' ({} clients)",
            client_id,
            room_name,
            room.clients.len()
        );

        Ok(if update.is_empty() {
            None
        } else {
            Some(update)
        })
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

            // Trigger save
            // Note: In production, you might want to debounce this or use a separate thread
            drop(txn); // Drop transaction before saving
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

            // Remove room if empty?
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
