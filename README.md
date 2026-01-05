# Corngr: The Post-File Operating System

> **Current Status:** Transitioning to Phase A/B/C Baseline

Corngr is a **Local-First, AI-Native Knowledge Operating System**. It replaces the fragmented concept of "files" (docs, slides, sheets) with a **Unified Data Grid** powered by CRDTs (Yjs) and secured by Ed25519 cryptography.

## 📚 Documentation Structure (New Baseline)
Development has been reorganized into three distinct phases to consolidate past progress and clarify future direction. Please refer to the specific baseline documents for architectural details:

*   **[Phase A: The Foundation](BASELINE_PHASE_A.md):** The core OS, Dual-Rendering Engine, Local-First Security, and WebSocket Sync.
*   **[Phase B: The Trust Layer](BASELINE_PHASE_B.md):** Governance, RBAC, Merkle Audit Logging, and IRAP Compliance.
*   **[Phase C: The Ecosystem](BASELINE_PHASE_C.md):** Marketplace, Plugins, UX Power Tools, and AI Integration.

## 🚀 Key Features
*   **Dual-View Engine:** Seamlessly toggle between Document (ProseMirror) and Slide (React) views with sub-16ms sync.
*   **Local-First Security:** All data is signed with Ed25519 keys locally. Identity is cryptographic, not just email-based.
*   **Compliance Time Machine:** Immutable, Merkle-chained audit logs ensure data integrity and full lineage tracking.
*   **Real-Time Collaboration:** Self-hosted Rust WebSocket server empowers secure, offline-capable collaboration.

## 🔧 Setup

### Prerequisites
- Node.js 18+
- Rust 1.70+

### Installation
1.  **Install dependencies**
    ```bash
    npm install
    ```
2.  **Run the development server**
    ```bash
    npm run tauri dev
    ```

## 📖 Architecture

### System Overview
```
┌─────────────────────────────────────────────────────┐
│                  Frontend (React)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ ProseMirror  │  │ SlideRenderer│  │ DemoApp   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │       │
│         └─────────────────┴─────────────────┘       │
│                           │                         │
│                  ┌────────▼────────┐                │
│                  │  Yjs Document   │                │
│                  └────────┬────────┘                │
│                           │                         │
└───────────────────────────┼─────────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │ Tauri WebSocket    │
                  └─────────┬──────────┘
                            │
                ┌───────────▼───────────┐
                │   Rust Backend        │
                │                       │
                │  • ABAC Engine        │
                │  • Crypto Signing     │
                │  • File Persistence   │
                └───────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌────▼─────┐  ┌──────▼──────┐
│ storage/*.bin│  │ node.key │  │ audit.jsonl │
│ (Snapshots)  │  │ (Crypto) │  │ (Logs)      │
└──────────────┘  └──────────┘  └─────────────┘
```

## 🧪 Testing
- **Rust Backend:** `cd src-tauri && cargo test`
- **Frontend:** `npm test`

## 📊 Performance Metrics (Verified)
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Transclusion | <10ms | 5.9ms | ✅ |
| Sync Latency | <16ms | ~5ms | ✅ |
| ABAC Overhead | <50ms | <1ms | ✅ |

---
**Status:** Baseline Established (Jan 2026)
