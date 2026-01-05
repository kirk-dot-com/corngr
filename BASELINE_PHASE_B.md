# Baseline: Phase B - The Trust Layer (Governance)

**Status:** ✅ COMPLETE
**Last Updated:** Jan 5, 2026

## Overview
Phase B elevates Corngr from a raw editor to a "Governance Platform" suitable for regulated environments. It introduces strict access controls, immutable audit trails, and information flow management (transclusion/lineage).

## Core Capabilities (Implemented)

### 1. Role-Based Access Control (RBAC)
*   **Enforcement:** Server-side check in `websocket_server.rs`.
*   **Roles:**
    *   **Editor:** Protocol read/write.
    *   **Auditor:** Read-only access to content + Full access to logs.
    *   **Viewer:** Read-only access `[STRICT]`.
*   **Mechanism:** Reject `SyncMessage::Update` payloads from non-editors at the socket level.

### 2. The "Compliance Time Machine" (Audit)
*   **Log Format:** Structured JSONL (`audit.jsonl`).
*   **Merkle Chaining:** Each log entry contains `hash(prev_hash + content)`, creating a tamper-evident chain.
*   **Events Logged:** `WS_CONNECT`, `BLOCK_UPDATE`, `WRITE_REJECTED`, `SIGNATURE_CREATED`.
*   **Location:** `src-tauri/src/audit/mod.rs`.

### 3. Data Lineage & Transclusion
*   **Global References:** Data blocks can be referenced across documents.
*   **Governance View:** "X-Ray Mode" (`src/components/governance/GovernanceDashboard.tsx`) allows auditors to see the history and provenance of every block in the document.

## Verification & Compliance
*   **IRAP Alignment:** Mapped to AC SC-07 (Security Logging) and AC-04 (Information Flow Enforcement).
*   **Security Dashboard:** Frontend view to inspect audit logs and integrity status (`src/components/security/SecurityDashboard.tsx`).
