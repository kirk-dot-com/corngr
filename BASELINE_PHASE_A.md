# Baseline: Phase A - The Secure Foundation

**Status:** ✅ COMPLETE
**Last Updated:** Jan 5, 2026

## Overview
Phase A establishes Corngr as a functional "Post-File Operating System." It proves the core technical hypothesis: a single Yjs data structure can be rendered as both a document and a slide deck, secured by local cryptography, and synchronized in real-time via a self-hosted WebSocket server.

## Core Capabilities (Implemented)

### 1. Dual-Mode Rendering (The "OS" Core)
*   **Single Source of Truth:** A Yjs `Y.Doc` serves as the underlying database.
*   **Editor View:** ProseMirror-based rich text editor for continuous documentation.
*   **Slide View:** React-based slide renderer that "auto-paginates" the same Yjs content.
*   **Sync:** Updates in one view reflect instantly in the other (sub-16ms latency).

### 2. Local-First Security (Crypto)
*   **Algorithm:** Ed25519 (Edwards-curve Digital Signature Algorithm).
*   **Implementation:** Rust-based `KeyManager` in `src-tauri/src/security/`.
*   **Function:** Every document change is cryptographically signed.
*   **Identity:** Users are identified by their public keys, not just emails.

### 3. Real-Time Collaboration (Network)
*   **Architecture:** Self-hosted Rust WebSocket Server (`src-tauri/src/websocket_server.rs`).
*   **Protocol:** Yjs Sync Protocol ("y-sync") over WebSocket.
*   **Isolation:** Per-document room isolation.
*   **Awareness:** Remote functionality (cursors, selections) is fully propagated.

### 4. Server-Side Persistence
*   **Storage:** Snapshots saved to `.corngr/storage/*.bin`.
*   **Logic:** Snoop on Yjs updates in the WebSocket server -> Save full state to disk.
*   **Recovery:** Server loads latest snapshot on startup.

## Component Map
| Component | Location | Status |
| :--- | :--- | :--- |
| **Backend** | `src-tauri/src/websocket_server.rs` | Stable |
| **Security** | `src-tauri/src/security/` | Stable |
| **Frontend** | `src/prosemirror/` | Stable |
| **Slides** | `src/components/slides/` | Stable |
