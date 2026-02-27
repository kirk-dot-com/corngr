# Corngr-ERP — Product Requirements Document (PRD) v1.0

> **Project Codename:** Antigravity  
> **Status:** Phase A Baseline (Feb 2026)  
> **Product:** AI-native, local-first "ERP-Grid" for SMEs in a post-file operating environment  
> **Primary Stack:** Tauri + Rust · React · Yjs (CRDT) / yrs · ProseMirror · Canvas/WebGL · Local LLM via Candle/llama-edge · Merkle-chained JSONL audit log with Ed25519 signatures  
> **North Star:** Atomic Data Integrity — business truth is shared CRDT state, not synced silos.

---

## 0. Terminology & Architecture Guardrails (Post-File Spine Alignment)

### 0.1 Terminology Policy

To remain aligned with the **Corngr Post-File Spine**, this PRD uses the following canonical terms:

| Canonical Term | Replaces |
|---|---|
| Unified Data Grid / Unified State | "database" as primary metaphor |
| Fragments / Atoms | "rows in tables" |
| Lenses | "modules as siloed systems" |
| Edge-native Rust/WASM | "microservices" as default deployment |
| Signed Mutations + Merkle Log | "audit tables" as source of truth |

> **Acceptance:** PRD, UI copy, and technical docs avoid "DB/API microservices" language except when comparing legacy approaches.

### 0.2 Architectural Posture

- **Edge-first:** The "brain" runs on SME hardware — Primary Node + Satellites.
- **CRDT-first:** Correctness comes from convergence, not central coordination.
- **Cryptographic truth:** Trust is mathematical (signatures + hash chain), not administrative logging.
- **Cloud-optional:** Cloud may exist later as backup/relay; it is not required for correctness or daily operation.

---

## 1. Product Summary

### 1.1 One-Liner

Corngr-ERP is a local-first, AI-native ERP that replaces file workflows and siloed modules with a real-time **Unified Data Grid** where every change is signed, attributable, and recoverable to any point in time.

### 1.2 The Market Trap (Why This Exists)

SMEs are stuck between:

- **Legacy ERPs** (SAP/Oracle-class): expensive, rigid, heavy to operate.
- **"Franken-stack" SaaS:** disconnected apps, duplicate data, brittle integrations, sync drift.

**Corngr-ERP's differentiator** is **Atomic Data Integrity**: inventory, sales, and finance are not separate tables that "sync" — they are different Lenses over the same Yjs fragments.

### 1.3 The Pivot: From OS to "ERP-Grid"

Corngr's OS logic becomes an ERP powerhouse through three unfair advantages:

| Advantage | Problem Solved | Solution |
|---|---|---|
| **#1 — Single Source of Truth (CRDTs)** | "Data lag" between warehouse, sales, finance | Unified Data Grid — fragments are the shared state across all Lenses |
| **#2 — IRAP-ready Trust (Ed25519 + Merkle logs)** | Regulated SMEs need audit trails without heavyweight systems | Every mutation signed and appended to a Merkle-chained log |
| **#3 — AI-native Living Data** | Legacy ERPs become data graveyards; analysis requires exports | On-device AI runs over the live stream and drafts Proposals grounded in signed reality |

---

## 2. Vision, Goals, and Non-Goals

### 2.1 Vision

Provide SMEs with an AI-native, local-first infrastructure as easy as a spreadsheet but as trustworthy as cryptography.

### 2.2 Goals (Phase A → Phase C)

| ID | Goal |
|---|---|
| G1 | **Single shared truth** — No module drift; Lenses render the same atoms. |
| G2 | **Zero-lag operations** — Sub-16ms propagation target on LAN; <10ms p2p updates target. |
| G3 | **Privacy by default** — Business data stays on local hardware; AI runs locally. |
| G4 | **Cryptographic integrity** — Every mutation signed; time-chain verifiable. |
| G5 | **Human finality** — No financial state becomes final without human signature. |
| G6 | **Post-file UX** — Feels like spreadsheets; "files" become views, not storage. |
| G7 | **Zero lock-in** — Standard Orbit export (Parquet + PDF/A + CSV/Sheets). |
| G8 | **Ecosystem extensibility (Phase C)** — Marketplace enables industry Lenses + plugins without data migration. |

### 2.3 Non-Goals (Phase A)

- Full payroll suite / full HR / advanced MRP/APS optimization.
- Cloud-native multi-tenant SaaS as the default model.
- Claims of "fraud proof" or "certainty" — integrity is cryptographic attribution + verifiability.

---

## 3. Target Users & Personas

### 3.1 Primary Personas

| Persona | Role | Core Need |
|---|---|---|
| **Sarah** | SME Owner | ERP that "just works" even with spotty internet; live business pulse and explainable next steps. |
| **David** | Accountant / Auditor | Click-to-lineage with signatures and point-in-time truth. |

### 3.2 Supporting Personas

| Persona | Core Need |
|---|---|
| Warehouse Lead | Receive/pick/ship in dead zones; sync later flawlessly. |
| Sales Rep | Draft quotes/invoices; ask natural language questions of the Grid. |
| Finance Lead | Approvals, payables/receivables, liquidity monitoring, anomaly review. |

---

## 4. Product Principles

1. **Local-first is real** — Actions complete locally; sync is a background improvement.
2. **Fragments over files** — State is atomic, composable, multi-viewable.
3. **Signed reality** — Every meaningful change is attributable and verifiable.
4. **AI proposes; humans sign** — Proposals never silently become final ledger truth.
5. **Export without lock-in** — Data always leaves cleanly in standard formats.
6. **Behavior matters** — Win by being spreadsheet-familiar while quietly more powerful.

---

## 5. Scope & Modules

### 5.1 Phase A — Baseline Deliverables

| Module | Codename |
|---|---|
| Unified Data Grid | The Spine |
| Sovereign Security | The Shield |
| Compliance Time Machine | — |
| Cockpit Dashboard | The Cockpit |
| Guardian AI | The Navigator |
| Migration Lens | Shatter |
| Standard Orbit Export | — |

### 5.2 Phase B — Candidates

Enhanced forecasting, advanced approvals, deeper domain templates (manufacturing/medical/defense), optional cloud backup/relay.

### 5.3 Phase C — Ecosystem

**Antigravity Marketplace (Lens Store):** industry lenses + logic plugins + AI personas.

---

## 6. Functional Requirements

### 6.1 The Unified Data Grid — The Spine

#### FR-SPINE-0 — Atomic Data Integrity *(defining requirement)*
> Inventory, accounting, and operational truth must be represented as one shared set of CRDT atoms, such that "Inventory" and "Accounting" are Lenses over the same underlying fragments — not separate reconciled domains.  
> **Acceptance:** Shipping an order updates inventory and receivables views without integration jobs or reconciliation runs.

#### FR-SPINE-1 — Fragment-First Storage
> All state is stored as Yjs CRDT fragments (Maps/Arrays/Text/XML) with stable IDs.  
> **Acceptance:** Any record (invoice line, stock movement, approval) maps to addressable fragments.

#### FR-SPINE-2 — Convergent Collaboration
> Multi-user edits converge deterministically without data loss.  
> **Acceptance:** Concurrent edits resolve via CRDT semantics and preserve authorship metadata.

#### FR-SPINE-3 — Hybrid Node Topology
> Support Primary Node (24/7 Merkle Anchor) and Satellite devices (laptops/tablets). Satellites run offline and sync later.  
> **Acceptance:** Offline changes queue locally and reconcile on reconnect.

#### FR-SPINE-4 — Dual-View Engine *(core UX)*
> Every core dataset supports at least two first-class Lenses: **Spreadsheet/Grid Lens** (finance/ops) and **Workflow Lens** (Kanban/Gantt/project/fulfillment).  
> **Acceptance:** Users can toggle Lenses without data migration.

#### FR-SPINE-5 — Edge-Native Sync Transport
> Node sync supports local network peer-to-peer patterns (mesh-capable), without requiring a central cloud round trip.  
> **Acceptance:** LAN operation remains fully functional even with no internet.

---

### 6.2 Sovereign Security — The Shield

#### FR-SHIELD-1 — Key-Based Identity (Ed25519)
> Replace passwords with Ed25519 public/private keys stored via secure enclave/keychain when available.  
> **Acceptance:** User identity is a public key; device identity may be separate.

#### FR-SHIELD-2 — Signed Mutations
> Every mutation to grid state is cryptographically signed before acceptance into the authoritative audit chain.  
> **Acceptance:** Any value can be traced to signature + timestamp + actor key (+ device key if enabled).

#### FR-SHIELD-3 — ABAC Policy Enforcement
> Permissions enforced by Rust engine using attributes (role, device trust, network/location, time-of-day, workflow state, entity type).  
> **Acceptance:** Permission checks are consistent across UI and engine; denials return structured reasons.

#### FR-SHIELD-4 — Standard SME Role Templates
> Provide default ABAC templates: **Owner/Admin, Manager, Accountant/Finance, Staff (warehouse/sales), External Auditor (read-only/time-bounded).**  
> **Acceptance:** Floor staff see stock but not COGS; manager sees both.

#### FR-SHIELD-5 — Key Revocation Across Nodes
> Managers can revoke keys; revoked keys cannot submit new mutations anywhere in the grid.  
> **Acceptance:** Revocation propagates; offline device attempts are rejected upon sync.

---

### 6.3 Compliance Time Machine

#### FR-TIME-1 — Merkle-Chained JSONL Audit Log
> Append each signed mutation to local JSONL where each entry hashes the previous entry (hash chain).  
> **Acceptance:** Chain verification runs locally; any tamper breaks integrity badge.

#### FR-TIME-2 — Point-in-Time Reconstruction
> Reconstruct ERP state at arbitrary timestamps (millisecond-resolution target) by replaying mutations (with checkpoints allowed).  
> **Acceptance:** UI can "scrub" to "Tuesday 2:14 PM" and see truthful historical state.

#### FR-TIME-3 — Click-to-Proof Audit UX
> Clicking any number shows: contributing fragments, signature(s), timestamps, device metadata (if enabled), approvals, and mutation diffs.  
> **Acceptance:** Auditor can export an evidence bundle for a period/transaction.

---

### 6.4 Guardian AI — The Navigator + CAIO Layer

#### FR-AI-1 — Local LLM Inference
> AI runs locally via Candle/llama-edge (or equivalent), with no default cloud dependency.  
> **Acceptance:** AI features degrade gracefully if model unavailable.

#### FR-AI-2 — Stream-Listening Proposals
> AI listens to Yjs update stream and drafts Proposals (never final actions).  
> Examples: draft invoice from completed project; propose reorder when stock drops; flag unusual refund.  
> **Acceptance:** Proposals are explicit objects separate from final ledger state.

#### FR-AI-3 — Grounding via Signed Reality *(anti-hallucination posture)*
> AI insights must reference signed sources (Merkle log entries + fragment IDs).  
> **Acceptance:** Every insight supports Drill-to-Source.

#### FR-AI-4 — Human-in-the-Loop Finality
> No financial transaction becomes final without human cryptographic signature.  
> **Acceptance:** Finalization flow always requires signer key action.

#### FR-AI-5 — CAIO Widget *(Chief AI Officer)*
> CAIO appears on Cockpit and provides: 3-point briefing on open/daily schedule; Pulse query ("Who approved overtime yesterday?") grounded in signatures/timestamps.  
> **Acceptance:** Clicking any briefing item drills to source fragments/log entries.

#### FR-AI-6 — Optional Knowledge Grid RAG Sidecar
> Provide optional vector store sidecar (Qdrant/Milvus-class) indexing signed fragments + docs for retrieval.  
> **Acceptance:** Ask-the-Grid answers cite retrieved signed sources; works offline.

---

### 6.5 Cockpit — Visualization Layer + Gen-UI

#### FR-COCKPIT-1 — Reactive Widgets
> KPIs subscribe to fragment sets; update without page refresh.  
> **Acceptance:** Updating payables instantly updates liquidity widget.

#### FR-COCKPIT-2 — Time-Travel Slider
> Dashboard can display historical pulse via reconstruction.  
> **Acceptance:** Slider scrubs to past state across widgets.

#### FR-COCKPIT-3 — Grid Health Map
> Visualize Primary vs. Satellites connectivity, last sync time, and backlog sizes.  
> **Acceptance:** Operator identifies unsynced nodes quickly.

#### FR-COCKPIT-4 — Gen-UI Lenses via Command Bar
> User can request new views ("sales by region heatmap"), producing validated Lens specs rendered as Canvas/WebGL + React UI.  
> **Acceptance:** Rendered Lens is derived from grid queries and uses a safe component registry.

#### FR-COCKPIT-5 — Ghost Mode Overlays
> Overlay projected fragments (forecasts/what-ifs) on top of actual fragments without overwriting official truth.  
> **Acceptance:** Projections are visually distinct and cannot become final without explicit signature workflow.

#### FR-COCKPIT-6 — Performance
> Widgets load <100ms once local store initialized (target).  
> **Acceptance:** Cockpit remains responsive under typical SME workloads.

**Strategic Cockpit Components (Baseline):**
- **Liquidity Wave** — Cash-on-hand vs. signed payables/receivables
- **Grid Health Map** — Node connectivity
- **Agentic Proposals Feed** — AI-drafted actions
- **Audit Integrity Badge** — Merkle chain valid/invalid

---

### 6.6 Migration Lens — Shatter

#### FR-SHATTER-1 — Drag-Drop Import
> User drags Excel/CSV into app; parsing is local.  
> **Acceptance:** Preview + validation before commit.

#### FR-SHATTER-2 — Mapping Assistance
> AI suggests column→atom mappings; user confirms.  
> **Acceptance:** User can correct mappings; system persists mapping templates.

#### FR-SHATTER-3 — Signed Ingestion Provenance
> Imported data becomes signed state changes with provenance labels ("Imported from X").  
> **Acceptance:** Audit chain records import session and author.

#### FR-GRID-ARROW-1 — Zero-Copy Batch Pipelines
> Use Arrow-style memory formats for high-volume ingestion/rollups.  
> **Acceptance:** Bulk import doesn't stall UI; minimal serialization overhead.

---

### 6.7 Standard Orbit Export *(Exit Strategy)*

#### FR-EXPORT-1 — Parquet Data Lake Export
> Export ledger + entities + relationships to Parquet with schema manifest.  
> **Acceptance:** Reproducible export, partitionable by time/entity.

#### FR-EXPORT-2 — PDF/A Archive Export
> Export human-readable archive of docs to PDF/A with embedded references to signatures/audit IDs.  
> **Acceptance:** Documents are audit-friendly and long-term preservable.

#### FR-EXPORT-3 — Sheets-Friendly Extracts
> Export any Lens result set to CSV/Sheets-compatible format.  
> **Acceptance:** Stable columns; user chooses scope/time window.

---

### 6.8 Optional Lineage Graph *(Phase A-lite)*

#### FR-GRID-GRAPH-1 — Graph-Based Traceability
> Maintain lightweight lineage links among key atoms (movement → invoice → approval → ledger).  
> **Acceptance:** Anomaly drill-down traverses lineage to the exact signed mutation(s).

---

## 7. Phase C — Antigravity Marketplace *(The Ecosystem / Lens Store)*

### 7.1 Purpose

The Marketplace is a **Lens Store**, not an App Store. Third-party builders create new ways to view and interact with existing fragments — not whole applications or duplicated data stores.

### 7.2 Marketplace Asset Types

| Type | Description | Example |
|---|---|---|
| **A) Industry Lenses** (UI/UX) | Dashboards, grids, workflows | Bakery Lens (batch sheets, oven schedules); Law Firm Lens (billable minutes, trust account views) |
| **B) Logic Plugins** (WASM) | Sandboxed Rust/WASM modules adding calculations/validations | Tax-Edge: computes GST/VAT and outputs derived fragments or Proposals |
| **C) AI Agent Personas** (CAIO extensions) | Domain-specialized CAIO behaviors | Supply Chain Optimizer: deeper reorder/predictive logic grounded in signed state |

### 7.3 Weightless Distribution Model *(no data migration)*

> Installing assets never migrates data. Lenses render existing fragments; plugins compute derived fragments or Proposals referencing existing atoms.  
> **Acceptance:** New Lens becomes usable immediately over current state.

### 7.4 Ecosystem Security *(capability-based)*

| Requirement | Description |
|---|---|
| **FR-MARKET-SEC-1** Sandboxed Execution | All plugins run in WASM within Tauri/Rust sandbox. |
| **FR-MARKET-SEC-2** Developer Signing & Verification | All assets cryptographically signed by developer identity; verified on install and load. |
| **FR-MARKET-SEC-3** Capability Manifest (least privilege) | Assets request explicit capabilities (read/write/execute). Default: read + propose only. Write access is scoped and admin-approved. Grants are signed + auditable. |
| **FR-MARKET-SEC-4** Private SME Registries | Support private registries for internal distribution (including LAN-only / air-gapped). |

> **Strategic rationale:** Corngr provides infrastructure; ecosystem provides domain expertise; SMEs escape vendor roadmaps.

---

## 8. Use Cases (Phase A)

### UC-1 — Offline Warehouse Scan *(dead zone)*
1. Tablet records inventory atom updates offline; signs mutations; queues outbox.
2. On reconnect, syncs to Primary Node.
3. Cockpit updates; audit shows author/device/time.

### UC-2 — Migration "Shatter" *(Excel → Grid)*
1. Drag Excel → parse/preview.
2. AI mapping → user confirm.
3. Signed ingestion — legacy data elevated into the Grid and becomes time-travelable/audit-ready.

### UC-3 — Audit Drill-Down *(number → signature)*
1. Click ledger total.
2. See contributing atoms + diffs + signatures.
3. Export evidence bundle.

### UC-4 — CAIO Morning Briefing *(grounded)*
1. CAIO generates 3-bullet briefing from signed changes.
2. Each bullet drills to source atoms/log entries.

---

## 9. User Stories (Baseline)

| Role | Story |
|---|---|
| Manager | I can revoke an employee key instantly across nodes so lost devices can't mutate truth. |
| Auditor | I can click any number and see signature, timestamp, and mutation lineage. |
| Sales Rep | I can ask "total sales to Client B this quarter" and get results with sources + export. |
| Warehouse Lead | I can scan inventory offline and sync later without conflict or loss. |
| Finance Lead | I can approve payables with my signature and see liquidity update instantly. |

---

## 10. Information Architecture & Screen List (Phase A)

| Screen | Description |
|---|---|
| Cockpit | Dashboard + CAIO |
| Grid | Spreadsheet lens |
| Workflow Lens | Kanban/Gantt views |
| Entities | Customers, Products, Vendors, Projects |
| Ledger | Entries, approvals, drill-down |
| Proposals | AI drafts awaiting review/sign |
| Time Machine | Timeline scrub + audit explorer |
| Node Health | Primary/Satellites, backlog |
| Import / Shatter | Migration |
| Export / Standard Orbit | Parquet, PDF/A, CSV/Sheets |
| Security & Keys | Identity, devices, ABAC templates, revocation |

---

## 11. Data Model *(Conceptual, Fragment-Backed)*

| Atom / Fragment | Description |
|---|---|
| `Party` | Customer/vendor/employee; associated keys |
| `Item` | SKU/part |
| `InventoryMovement` | Qty, location, references |
| `Document` | Invoice/PO/delivery note (ProseMirror/Yjs doc) |
| `LedgerEntry` | Line items, amounts, links to docs |
| `Approval` | Signer key, scope, timestamp, policy result |
| `Proposal` | AI-drafted changes; non-final |
| `Policy/CapabilityGrant` | Signed, time-travelable |

---

## 12. Non-Functional Requirements & Benchmarks (Phase A)

### Performance

| Metric | Target |
|---|---|
| State sync (LAN p2p) | <10ms (goal <5ms for key cockpit signals) |
| ABAC overhead (Rust engine) | <1ms per permission check |
| Cold start | Interactive <1.5s |
| Widget render | <100ms after store init |

### Reliability / Offline
- All core actions function offline.
- Outbox persists across restarts.
- Conflicts auto-resolve via CRDT.

### Security / Privacy
- Keys stored securely where possible.
- Signed mutations enforced by engine.
- Local AI by default.

### Observability
- Local diagnostics: sync lag, queue depth, chain verification status.
- Exportable support bundle (policy-redacted).

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Ledger semantics vs. CRDT merges | Enforce workflow separation (Proposal vs. Final) + signature gates |
| Key loss/recovery | Define admin recovery policy (e.g., multi-sig or owner override) without weakening defaults |
| Time travel compute cost | Checkpoints/snapshots for reconstruction; progressive loading for long histories |
| Gen-UI safety | Lens generation restricted to validated query DSL + component registry; no arbitrary code injection |

---

## 14. Implementation Strategy & Phasing

### Phase A — Baseline Build Order
1. Universal Transaction Atom / Master Ledger schema *(keystone for shared truth)*
2. ABAC templates + signed mutation envelope *(deployability + safety)*
3. Cockpit prototype + CAIO drill-to-source *(proof of "live pulse")*
4. Time Machine + audit explorer
5. Shatter import + Standard Orbit exports

### Phase B — Operational Hardening + Candidates
- Advanced approvals & control layer
- Enhanced forecasting / projections (Ghost Mode)
- Deeper domain templates (Lens Packs: manufacturing/medical/defense)
- Scale/performance hardening (checkpointing, indexing, rollups)
- Admin/ops console (keys/devices/diagnostics)
- Optional cloud backup/relay (non-authoritative)

### Phase C — Ecosystem
- Marketplace: Lens Store + WASM plugins + AI persona packages
- Developer signing; capability model; private registries

---

## 15. Definition of Done (Phase A Acceptance Criteria)

- [ ] Warehouse tablet can create inventory movements offline, later sync, and update cockpit **without manual reconciliation**.
- [ ] Any ledger number can be traced to signed mutations and inspected (signature + timestamp + actor + diff).
- [ ] Time-travel slider reconstructs cockpit state for a chosen past timestamp.
- [ ] AI outputs are **Proposals only**; every insight supports drill-to-source; no silent finalization.
- [ ] Standard Orbit export works locally: Parquet + PDF/A + CSV/Sheets.
- [ ] Benchmarks met on representative SME devices/network conditions.

---

## 16. ERP-Grid Skills & Capabilities Matrix *(Team Readiness Checklist)*

| Domain | Skills Required |
|---|---|
| Architectural & Deployment | CRDTs, Tauri/Rust, mesh/P2P sync, WASM lens execution |
| AI & Intelligence | On-device LLM, stream-listening agents, grounded RAG sidecar |
| Data Engineering | CRDT schema discipline, Arrow zero-copy, optional lineage graph |
| Security & Trust | Ed25519 identity, Merkle audit, ABAC with rich attributes |
| Functional Lenses | Collaborative accounting, supply chain twins, declarative business rules DSL |
| Human Interface | Intent-based UX (Gen-UI), HITL approval/signature guardrails |

---

*Document maintained as a living reference. Version updates tracked via Merkle-chained audit log upon system activation.*
