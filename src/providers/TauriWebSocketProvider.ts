import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

/**
 * Tauri WebSocket Provider
 * Connects to the Tauri-native WebSocket collaboration server (ws://localhost:3030)
 * 
 * This replaces the Supabase-based TauriSecureNetwork with a self-contained,
 * Rust-native WebSocket server for real-time collaboration.
 */
export class TauriWebSocketProvider {
    private provider: WebsocketProvider
    private documentId: string
    private serverUrl: string

    constructor(
        documentId: string,
        ydoc: Y.Doc,
        serverUrl: string = 'ws://localhost:3030'
    ) {
        this.documentId = documentId
        this.serverUrl = serverUrl

        console.log(`🔌 Connecting to Tauri WebSocket server: ${serverUrl} (doc: ${documentId})`)

        this.provider = new WebsocketProvider(serverUrl, documentId, ydoc, {
            connect: true,
            // y-websocket will automatically handle awareness
        })

        this.setupEventHandlers()
    }

    private setupEventHandlers() {
        this.provider.on('status', (event: { status: string }) => {
            console.log(`📡 WebSocket Status: ${event.status}`)

            if (event.status === 'connected') {
                console.log(`✅ Connected to collaboration server (${this.documentId})`)
            } else if (event.status === 'disconnected') {
                console.log(`🔌 Disconnected from server, will auto-reconnect...`)
            }
        })

        this.provider.on('sync', (isSynced: boolean) => {
            if (isSynced) {
                console.log(`🔄 Document synced with server (${this.documentId})`)
            }
        })

        // Log connection errors
        this.provider.on('connection-error', (error: Event) => {
            console.error(`❌ WebSocket connection error:`, error)
        })

        // Log when connection closes
        this.provider.on('connection-close', (event: CloseEvent | null) => {
            if (event) {
                console.log(`🔌 Connection closed (code: ${event.code}, reason: ${event.reason})`)
            } else {
                console.log(`🔌 Connection closed`)
            }
        })
    }

    /**
     * Get the awareness instance for cursor/presence tracking
     */
    get awareness() {
        return this.provider.awareness
    }

    /**
     * Get the sync provider instance
     */
    getSyncProvider() {
        return this.provider
    }

    /**
     * Manually disconnect from the server
     */
    disconnect() {
        console.log(`🔌 Manually disconnecting from ${this.serverUrl}`)
        this.provider.disconnect()
    }

    /**
     * Manually reconnect to the server
     */
    connect() {
        console.log(`🔌 Manually reconnecting to ${this.serverUrl}`)
        this.provider.connect()
    }

    /**
     * Destroy the provider and clean up resources
     */
    destroy() {
        console.log(`🗑️  Destroying WebSocket provider for ${this.documentId}`)
        this.provider.destroy()
    }

    /**
     * Check if currently connected
     */
    get connected(): boolean {
        return this.provider.wsconnected
    }

    /**
     * Check if currently synced with server
     */
    get synced(): boolean {
        return this.provider.synced
    }
}
