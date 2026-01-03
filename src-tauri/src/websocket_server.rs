use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use y_sync::sync::{Error as SyncError, Message as SyncMessage, MessageReader};
use yrs::{Doc, StateVector, Update};

/// A room contains a shared Yjs document and all connected clients
pub struct Room {
    pub doc: Doc,
    pub clients: Vec<ClientConnection>,
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

        let ws_stream = accept_async(stream).await?;
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Channel for sending messages to this client
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();

        // Room name will be extracted from the first message (sync step 1)
        let mut room_name: Option<String> = None;
        let client_id = rand::random::<u64>();

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
                            // Parse Yjs sync message
                            if let Err(e) = self.handle_yjs_message(
                                &data,
                                &mut room_name,
                                client_id,
                                &tx,
                            ).await {
                                eprintln!("❌ Error handling Yjs message: {}", e);
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
        if let Some(room) = room_name {
            self.remove_client_from_room(&room, client_id).await;
        }

        Ok(())
    }

    /// Handle a Yjs sync protocol message
    async fn handle_yjs_message(
        &self,
        data: &[u8],
        room_name: &mut Option<String>,
        client_id: u64,
        tx: &tokio::sync::mpsc::UnboundedSender<Message>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut decoder = MessageReader::new(data);

        // Read sync message type
        let message = decoder.read()?;

        match message {
            SyncMessage::Sync(sync_msg) => {
                // Handle sync message (SyncStep1, SyncStep2, or Update)
                match sync_msg {
                    y_sync::sync::SyncMessage::SyncStep1(sv) => {
                        // Client is requesting initial sync
                        // Extract room name from somewhere (you may need to modify protocol)
                        // For now, use a default room
                        let room = room_name.get_or_insert_with(|| "default".to_string());

                        self.handle_sync_step1(room, sv, client_id, tx).await?;
                    }
                    y_sync::sync::SyncMessage::SyncStep2(update) => {
                        if let Some(room) = room_name.as_ref() {
                            self.handle_sync_step2(room, update).await?;
                        }
                    }
                    y_sync::sync::SyncMessage::Update(update) => {
                        if let Some(room) = room_name.as_ref() {
                            self.broadcast_update(room, update, client_id).await?;
                        }
                    }
                }
            }
            SyncMessage::Awareness(awareness_update) => {
                // Broadcast awareness update to all clients in the room
                if let Some(room) = room_name.as_ref() {
                    self.broadcast_awareness(room, &awareness_update, client_id)
                        .await?;
                }
            }
            _ => {
                // Custom messages or other types
            }
        }

        Ok(())
    }

    /// Handle SyncStep1: Client requests document state
    async fn handle_sync_step1(
        &self,
        room_name: &str,
        state_vector: StateVector,
        client_id: u64,
        tx: &tokio::sync::mpsc::UnboundedSender<Message>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut rooms = self.rooms.write().await;

        // Get or create room
        let room = rooms.entry(room_name.to_string()).or_insert_with(|| Room {
            doc: Doc::new(),
            clients: Vec::new(),
        });

        // Add client to room
        room.clients.push(ClientConnection {
            client_id,
            tx: tx.clone(),
        });

        // Send SyncStep2 with current document state
        let update = room.doc.encode_state_as_update_v1(&state_vector);
        let sync_step2 = y_sync::sync::SyncMessage::SyncStep2(Update::decode_v1(&update)?);

        let mut encoder = Vec::new();
        SyncMessage::Sync(sync_step2).encode(&mut encoder);

        tx.send(Message::Binary(encoder))?;

        println!(
            "📥 Client {} joined room '{}' ({} clients)",
            client_id,
            room_name,
            room.clients.len()
        );

        Ok(())
    }

    /// Handle SyncStep2: Apply client's document state
    async fn handle_sync_step2(
        &self,
        room_name: &str,
        update: Update,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let rooms = self.rooms.read().await;

        if let Some(room) = rooms.get(room_name) {
            let txn = room.doc.transact_mut();
            txn.apply_update(update)?;
        }

        Ok(())
    }

    /// Broadcast document update to all clients in a room (except sender)
    async fn broadcast_update(
        &self,
        room_name: &str,
        update: Update,
        sender_id: u64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let rooms = self.rooms.read().await;

        if let Some(room) = rooms.get(room_name) {
            // Apply update to server's document
            let txn = room.doc.transact_mut();
            txn.apply_update(update.clone())?;
            drop(txn);

            // Broadcast to all clients except sender
            let mut encoder = Vec::new();
            SyncMessage::Sync(y_sync::sync::SyncMessage::Update(update)).encode(&mut encoder);
            let msg = Message::Binary(encoder);

            for client in &room.clients {
                if client.client_id != sender_id {
                    let _ = client.tx.send(msg.clone());
                }
            }
        }

        Ok(())
    }

    /// Broadcast awareness update to all clients
    async fn broadcast_awareness(
        &self,
        room_name: &str,
        awareness_update: &y_sync::awareness::Update,
        sender_id: u64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let rooms = self.rooms.read().await;

        if let Some(room) = rooms.get(room_name) {
            let mut encoder = Vec::new();
            SyncMessage::Awareness(awareness_update.clone()).encode(&mut encoder);
            let msg = Message::Binary(encoder);

            for client in &room.clients {
                if client.client_id != sender_id {
                    let _ = client.tx.send(msg.clone());
                }
            }
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

            // Remove room if empty
            if room.clients.is_empty() {
                rooms.remove(room_name);
                println!("🗑️  Room '{}' removed (no clients)", room_name);
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
