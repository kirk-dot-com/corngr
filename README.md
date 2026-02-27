# Corngr-ERP: The Post-File ERP-Grid

> **Codename:** Antigravity  
> **Status:** Phase A Baseline (Feb 2026)  
> **Stack:** Tauri + Rust · React · Yjs/yrs (CRDT) · Ed25519 · ProseMirror · Canvas/WebGL · Local LLM

Corngr-ERP is a **local-first, AI-native ERP** for SMEs. It replaces file workflows and siloed modules with a real-time **Unified Data Grid** where every change is signed, attributable, and recoverable to any point in time.

Business truth is not synced between tables — Inventory, Sales, and Finance are **Lenses over the same CRDT fragments**.

---

## Why This Exists

SMEs are stuck between legacy ERPs (expensive, rigid) and "Franken-stack" SaaS (disconnected apps, sync drift, duplicate data).

Corngr-ERP's answer is **Atomic Data Integrity** — three unfair advantages baked into the architecture:

### 1. Single Source of Truth (CRDTs)
Traditional ERPs suffer "data lag" — the warehouse sees one number, sales sees another.

Corngr-ERP uses a **Unified Data Grid**. An invoice is not a file; it is a set of Yjs fragments. When the warehouse updates a "Shipped" status, the Accounts Receivable view reflects it in <5ms. No integration jobs. No reconciliation runs.

### 2. IRAP-Ready Trust (Ed25519 + Merkle Logs)
Regulated SMEs (Defence, Medical, Finance) need audit trails without heavyweight systems.

Every mutation is **cryptographically signed** and appended to a **Merkle-chained audit log**. The Compliance Time Machine shows exactly who signed a change, with what key, at what time — and can reconstruct state at any millisecond in history.

### 3. AI-Native Living Data
Legacy ERPs are data graveyards. Analysis requires an Excel export.

Because the backend is Rust-based and data is local-first, **local LLMs run directly on the live data stream** (via Candle / llama-edge). An AI agent monitors the Yjs update stream and surfaces proactive proposals: *"Supplier lead times are increasing — suggest reordering 20% more stock now."* Proposals are never silent; humans sign to finalise.

---

## Feature Mapping: Core → ERP

| Corngr Core | ERP Application |
|---|---|
| **Dual-View Engine** | Toggle between Spreadsheet (Finances) and Kanban/Gantt (Project / Fulfilment) |
| **ABAC Engine** | Granular permissions: floor staff see stock levels; only Finance sees COGS |
| **Local-First Sync** | Warehouse staff scan inventory in dead zones; syncs perfectly on reconnect |
| **Tauri/Rust Backend** | Sub-1ms ABAC checks; high-speed payroll and tax calculations without UI lag |
| **Merkle Audit Log** | Click any number → see the signing key, timestamp, and full mutation lineage |
| **CRDT Fragments** | Inventory, accounting, and sales are Lenses — not reconciled silos |

---

## Scope & Phases

### Phase A — Baseline (current)
- **Unified Data Grid (The Spine)** — shared CRDT atoms; Dual-View Lenses
- **Sovereign Security (The Shield)** — Ed25519 identity; signed mutations; ABAC
- **Compliance Time Machine** — Merkle-chained JSONL audit log; point-in-time reconstruction
- **Cockpit + Guardian AI (The Navigator)** — CAIO dashboard; stream-listening proposals
- **Migration Lens (Shatter)** — drag-drop CSV/Excel → signed Grid state
- **Standard Orbit Export** — Parquet + PDF/A + CSV/Sheets

### Phase B — Operational Hardening
Advanced approvals, enhanced forecasting (Ghost Mode), domain Lens packs (manufacturing/medical/defence), checkpointing, optional cloud backup/relay.

### Phase C — Ecosystem
**Antigravity Marketplace (Lens Store):** industry Lenses + WASM logic plugins + AI Agent personas. Sandboxed, signed, capability-gated. No data migration on install.

---

## System Reference Documents

| Document | Description |
|---|---|
| [PRD.md](./PRD.md) | Product Requirements Document v1.0 — full functional requirements, use cases, NFRs |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture v1 — component diagram, data flows, security model, threat model |
| [TECHNICAL_BLUEPRINT.md](./TECHNICAL_BLUEPRINT.md) | Rust↔Yjs Bridge engineering spec — mutation envelope, lifecycle, ABAC, sync |
| [SCHEMA_SPEC.md](./SCHEMA_SPEC.md) | Universal Transaction Atom & Master Ledger Schema v1 — fragment layout, posting rules |
| [SCHEMA_BRIDGE_MAPPING.md](./SCHEMA_BRIDGE_MAPPING.md) | Schema-to-Bridge op patterns — canonical ops + ABAC checks per fragment type |
| [API_CONTRACTS.md](./API_CONTRACTS.md) | Rust engine API contracts v1 — 12 endpoints with request/response shapes and error codes |
| [SKILLS.md](./SKILLS.md) | ERP-Grid skills matrix — 7 capability domains for the build team |

---

## Setup

### Prerequisites
- Node.js 18+
- Rust 1.70+

### Run (Development)
```bash
npm install
npm run tauri dev
```

### Build
```bash
npm run tauri build
```

Produces: macOS `.dmg` · Windows `.msi` · Linux `.AppImage` / `.deb`

---

## Performance Targets (Phase A)

| Metric | Target | Verified |
|---|---|---|
| LAN p2p state sync | <10ms | ✅ ~5ms |
| ABAC overhead (Rust) | <1ms per check | ✅ <1ms |
| Cold start (interactive) | <1.5s | — |
| Widget render (post store init) | <100ms | — |

---

## Testing

```bash
# Rust engine
cd src-tauri && cargo test

# Frontend
npm test
```

---

## North Star

> **Atomic Data Integrity** — business truth is shared CRDT state, not synced silos.

*Feels like a spreadsheet. Trustworthy as cryptography.*

---

**Last Updated:** 27 February 2026 · Phase A Baseline
