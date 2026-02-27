# Corngr-ERP — Implementation Plan v1

> **Codename:** Antigravity  
> **Scope:** Phase A Baseline (Feb 2026)  
> **Grounded in:** [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECHNICAL_BLUEPRINT.md](./TECHNICAL_BLUEPRINT.md) · [SCHEMA_SPEC.md](./SCHEMA_SPEC.md) · [SCHEMA_BRIDGE_MAPPING.md](./SCHEMA_BRIDGE_MAPPING.md) · [API_CONTRACTS.md](./API_CONTRACTS.md)  
> **North Star:** Atomic Data Integrity — every change is signed, attributable, and recoverable.

---

## Guiding Principles (From PRD §4)

1. **Local-first is real** — actions complete locally; sync is a background improvement.
2. **Fragments over files** — state is atomic, composable, multi-viewable.
3. **Signed reality** — every meaningful change is attributable and verifiable.
4. **AI proposes; humans sign** — proposals never silently become final ledger truth.
5. **Engine is gatekeeper** — ABAC + posting invariants enforced in Rust, not the UI.

---

## Phase A Build Order (PRD §14)

The PRD defines five keystone deliverables for Phase A. This plan details each into concrete engineering milestones:

| Priority | Keystone | Rationale |
|---|---|---|
| 1 | Universal Transaction Atom + Master Ledger schema | All other Lenses depend on this shared truth |
| 2 | ABAC templates + signed mutation envelope | Safety and deployability gate |
| 3 | Cockpit prototype + CAIO drill-to-source | Proof of "live pulse" and AI proposals |
| 4 | Compliance Time Machine + audit explorer | Verifiability and time-travel |
| 5 | Shatter import + Standard Orbit exports | Onboarding and exit strategy |

---

## Milestone 1 — Universal Transaction Atom & Master Ledger (The Spine)

**PRD refs:** FR-SPINE-0 through FR-SPINE-5 · §11 Data Model  
**Schema refs:** SCHEMA_SPEC.md §3–5 · SCHEMA_BRIDGE_MAPPING.md §2  
**API refs:** API_CONTRACTS.md — `create_tx`, `add_line`, `edit_line`, `create_invmove`, `generate_postings`

### 1.1 Fragment Schema Implementation (Rust + yrs)

Define stable yrs/Yjs fragment structures for:

- `tx:{tx_id}:hdr` — TxAtom header (Y.Map)
- `tx:{tx_id}:lines` — business lines array (Y.Array of tx_line_ids)
- `txline:{tx_line_id}` — line fragment (Y.Map)
- `tx:{tx_id}:postings` — ledger lines array (Y.Array of posting_ids)
- `posting:{posting_id}` — double-entry posting (Y.Map)
- `invmove:{move_id}` — inventory movement (Y.Map)
- `approval:{approval_id}` — approval/signature atom (Y.Map)
- `account:{account_id}` — Chart of Accounts entry (Y.Map)
- `party:{party_id}` — customer/vendor/employee (Y.Map)
- `org:{org_id}:indexes` — master index maps (Y.Map of Y.Arrays)

**Acceptance:** Any record maps to an addressable fragment via stable ULID-based ID.

### 1.2 Rust Engine — Op Application Layer

Implement the `apply_ops()` function in the Rust↔Yjs Bridge:

```rust
// Map ops to yrs transactions
map_set(fragment_id, key, value)  → YMap::insert
map_del(fragment_id, key)         → YMap::remove
array_insert(fragment_id, i, v[]) → YArray::insert
array_delete(fragment_id, i, n)   → YArray::remove_range
text_apply_delta(fragment_id, d)  → YText::apply_delta
link_add(from, to, rel_type)      → lineage index update
proposal_create(...)              → Proposal fragment write
```

**Acceptance:** All SCHEMA_BRIDGE_MAPPING pattern ops apply deterministically to yrs.

### 1.3 Ledger Engine — Posting Rules (Rust)

Implement posting template engine for Phase A tx types:

| Tx Type | Posting Template |
|---|---|
| `invoice_out` | DR Accounts Receivable / CR Revenue / CR Tax Payable (+ COGS if ship) |
| `invoice_in` | DR Expense or Inventory / CR Accounts Payable / CR Tax |
| `payment_in` | DR Bank / CR Accounts Receivable |
| `payment_out` | DR Accounts Payable / CR Bank |
| `stock_receipt` | DR Inventory Asset / CR Accounts Payable or GRNI |
| `stock_issue` | DR COGS or Expense / CR Inventory Asset |
| `stock_adjust` | DR/CR Inventory Asset + Adjustment account (signed) |
| `journal` | Manual — user-defined debit/credit pairs |
| `credit_note` | Mirror of `invoice_out` with opposite directions |
| `debit_note` | Mirror of `invoice_in` with opposite directions |

**Acceptance:** `generate_postings` produces balanced draft postings for all 9 tx types.

### 1.4 Post Ceremony Invariants (Rust)

Enforce at `post_tx` time:
- `sum(debit amounts) == sum(credit amounts)` within `rounding_tolerance` (default 0.01)
- All `invmove.item_id` match parent `txline.item_id`
- `qty_delta` sign matches `inventory_effect` direction
- Required approval atoms exist (`type=post`) with valid `signature_ref`
- No draft postings remain; all finalized to `status=final`

**Acceptance:** `ERR_BALANCE_FAIL`, `ERR_APPROVAL_MISSING`, `ERR_ITEM_MISMATCH` returned correctly; balanced + approved tx transitions to `posted`.

### 1.5 Index Maintenance (Engine-Only)

Auto-maintain on every relevant mutation:
- `org:{id}:indexes.tx_by_time`
- `org:{id}:indexes.tx_by_type:{type}`
- `org:{id}:indexes.tx_by_party:{party_id}`
- `org:{id}:indexes.postings_by_account:{account_id}`
- `org:{id}:indexes.inventory_moves_by_item:{item_id}`
- `org:{id}:indexes.approvals_by_tx:{tx_id}`

**Acceptance:** Lens queries on indexes return correct, current results without full-state scans.

### 1.6 Status State Machine (Rust engine enforced)

```
draft → proposed → approved → posted (immutable)
draft/proposed → void
posted → [reversal creates new tx]
```

**Acceptance:** Invalid transitions return `ERR_INVALID_STATUS`; UI cannot force a status skip.

---

## Milestone 2 — Sovereign Security: ABAC + Signed Mutation Envelope (The Shield)

**PRD refs:** FR-SHIELD-1 through FR-SHIELD-5  
**Blueprint refs:** TECHNICAL_BLUEPRINT.md §3–6  
**Schema refs:** SCHEMA_BRIDGE_MAPPING.md §1  

### 2.1 Ed25519 Key Management

- Generate Ed25519 keypairs per user; store via OS keychain/secure enclave when available
- Optional device keypair for dual-key audit trail
- Key metadata stored as `party:{id}` fragment with linked pubkeys

**Acceptance:** User identity is a public key; login does not use passwords.

### 2.2 Mutation Envelope (Canonical Signing)

Implement the full `MutationEnvelope` struct:

```rust
struct MutationEnvelope {
    envelope_version: &str,   // "1"
    org_id:           String,
    mutation_id:      Ulid,
    actor_pubkey:     Ed25519PublicKey,
    device_pubkey:    Option<Ed25519PublicKey>,
    issued_at_ms:     i64,
    lamport:          u64,      // per-actor monotonic clock
    prev_hash:        [u8; 32], // Merkle chain link
    capability_token_id: Option<String>,
    ops:              Vec<Op>,
    policy_context:   PolicyContext,
    content_hash:     [u8; 32], // hash of canonical ops
    signature:        Ed25519Signature,
    attachments:      Vec<Attachment>,
}
```

Signing covers: `envelope_version || content_hash || prev_hash || lamport || issued_at_ms`

**Acceptance:** Signature verifies deterministically; `content_hash` stable regardless of JSON field order.

### 2.3 ABAC Policy Engine (Rust)

Implement attribute-based policy evaluation:

```rust
fn check_abac(
    actor: &ActorContext,
    action: &Action,
    resource: &Resource,
    tx_context: Option<&TxContext>,
) -> Result<(), AbacError>
```

Phase A default policies (SCHEMA_BRIDGE_MAPPING §1.4):
- P1: `tx.create/edit` — staff/manager/finance; `status ∈ {draft, proposed}`
- P2: `posting.create/finalize` — finance; manager below threshold
- P3: `invmove.create` — staff/manager/finance; tx not posted
- P4: `tx.post` — finance; requires post approval atom
- P5: `tx.reverse` — finance; requires reverse approval
- P6: `index.update` — engine-only; always deny from UI/plugins

**Acceptance:** ABAC overhead <1ms per check (per PRD §12 NFR).

### 2.4 Role Templates (SME Defaults)

Ship four ABAC role templates out of box:

| Role | Description |
|---|---|
| `owner_admin` | Full access including key/policy management |
| `manager` | Draft, approve, post within thresholds |
| `finance` | Full ledger access; post/reverse; audit exports |
| `staff` | Draft ops and inventory moves only; no COGS/posting access |
| `auditor` | Read-only + time travel + evidence bundle export |

**Acceptance:** Role templates enforce ARCHITECTURE.md §Security Model table exactly.

### 2.5 Key Revocation

- Revocation is a signed policy mutation; propagates to all nodes
- Revoked keys rejected at anchor time on Primary
- Offline device revocation queued and enforced on reconnect

**Acceptance:** Revoked key cannot submit mutations that anchor successfully (FR-SHIELD-5).

### 2.6 Replay Protection

Maintain per-actor:
- `max_lamport_seen` map
- Recent `mutation_id` bloom filter or set

Reject: duplicate `mutation_id` → `ERR_REPLAY_MUTATION_ID`; lamport rewind → `ERR_LAMPORT_REWIND`

---

## Milestone 3 — Cockpit + Guardian AI / CAIO (The Navigator)

**PRD refs:** FR-COCKPIT-1 through FR-COCKPIT-6 · FR-AI-1 through FR-AI-6  
**Architecture refs:** ARCHITECTURE.md §Data Flows

### 3.1 Cockpit Dashboard (React + Canvas/WebGL)

Implement the four strategic Cockpit widgets (PRD §6.5):

| Widget | Data source | Update trigger |
|---|---|---|
| **Liquidity Wave** | `postings_by_account` (bank + AR + AP accounts) | On any posting finalization |
| **Grid Health Map** | Node sync status + outbox queue depth | On sync heartbeat |
| **Agentic Proposals Feed** | `proposal:*` fragments | On any `proposal_create` op |
| **Audit Integrity Badge** | Last verified Merkle chain head | On chain verification run |

All widgets subscribe to Yjs fragment sets and update without page refresh (FR-COCKPIT-1).

**Acceptance:** Widget render <100ms after store init; Liquidity Wave updates on payable finalization.

### 3.2 Dual-View Engine (Grid + Workflow Lenses)

- **Grid Lens (Spreadsheet):** Render `tx_by_time` index as sortable/filterable table; inline editable for draft tx
- **Workflow Lens (Kanban):** Render tx by `status` swim lanes; drag to trigger `transition_tx_status`

**Acceptance:** Users can toggle Lenses without data migration (FR-SPINE-4).

### 3.3 Guardian AI — CAIO (Local LLM Integration)

- Integrate Candle / llama-edge for on-device inference (degrade gracefully if unavailable)
- AI listens to Yjs update stream via `YDoc.on('update', ...)` and evaluates business events
- AI outputs are **Proposals only** — `proposal_create` ops; never direct mutations

Phase A CAIO capabilities:
- **Morning briefing** — 3-bullet daily summary from signed changes (FR-AI-5)
- **Reorder proposals** — flag when `invmove` sums cross a low-stock threshold
- **Anomaly flag** — unusual payment amounts or refund patterns
- **Draft invoice** — propose invoice when a project's linked moves complete

**Acceptance:** AI outputs only `proposal_create` ops; every insight references signed source fragments; drill-to-source works (FR-AI-3/4).

### 3.4 Drill-to-Source (Audit UX)

- Clicking any Cockpit number → opens lineage panel
- Lineage panel traverses: `posting → tx → tx_line → invmove → approval → mutation_envelope`
- Displays: actor pubkey, `signed_at_ms`, `signature_ref`, mutation diff, `prev_hash`

**Acceptance:** `get_tx_snapshot(include_audit_refs=true)` returns full lineage; UI renders it.

### 3.5 Gen-UI Command Bar (FR-COCKPIT-4)

- Natural language command bar requests new Lens views
- Engine validates request against a safe query DSL + component registry
- Renders result as Canvas/WebGL + React Lens (no arbitrary code injection)

**Acceptance:** "Sales by customer this quarter" generates a filtered grid Lens; DSL validation prevents unsafe queries.

---

## Milestone 4 — Compliance Time Machine + Audit Explorer

**PRD refs:** FR-TIME-1 through FR-TIME-3  
**Blueprint refs:** TECHNICAL_BLUEPRINT.md §4–5

### 4.1 Merkle-Chained JSONL Audit Log

Each mutation envelope appended to local JSONL:

```jsonl
{"mutation_id":"01HZY…","prev_hash":"a3f…","content_hash":"9b2…","signature":"ed…","ops":[…],"issued_at_ms":1709055000000}
```

On load/sync: verify full chain (`prev_hash` linkage); surface `ERR_ANCHOR_CONFLICT` if tampered.

**Acceptance:** Modifying any JSONL entry breaks chain verification; integrity badge shows failed status (FR-TIME-1).

### 4.2 Two-Stage Anchoring (Satellite → Primary)

As per TECHNICAL_BLUEPRINT.md §5:
- Satellite produces envelopes chaining to local head
- Primary wraps each in an **Anchor Entry** binding it to the canonical chain
- Anchor Entry contains: `anchor_prev_hash`, `satellite_envelope_hash`, `anchor_signature`

Outbox states: `local_accepted → sent_to_primary → anchored / rejected / quarantined`

**Acceptance:** Offline mutations queue; reconnect anchors them; cockpit shows anchor status badge per record.

### 4.3 Point-in-Time Reconstruction (Time Machine)

- Replay mutation log from genesis to target timestamp to reconstruct any past state
- Phase A: compute-on-replay (no checkpoints required)
- Phase B hook: checkpoint every N mutations for faster reconstruction

**Acceptance:** Time-travel slider reconstructs cockpit state for an arbitrary past timestamp (FR-TIME-2).

### 4.4 Audit Explorer UI

- Timeline scrub slider on Cockpit
- Click any ledger number → **Click-to-Proof** panel (FR-TIME-3):
  - Contributing fragments
  - Signature(s) + `actor_pubkey`
  - `issued_at_ms` + device metadata (if enabled)
  - Mutation diff (before/after values)
  - Approval chain
- **Export evidence bundle**: JSON + PDF/A export of all above for auditor

**Acceptance:** Auditor can export an evidence bundle for any period/transaction.

---

## Milestone 5 — Shatter Import + Standard Orbit Export

**PRD refs:** FR-SHATTER-1 through FR-SHATTER-3 · FR-EXPORT-1 through FR-EXPORT-3 · FR-GRID-ARROW-1

### 5.1 Shatter Migration Lens (Excel/CSV → Grid)

- Drag-and-drop Excel/CSV; parse locally (no server upload)
- Preview + validation table before commit
- AI-assisted column → atom mapping with user confirmation
- Persist mapping templates for repeat imports
- Ingestion creates signed `TxAtom` fragments with provenance label: `"Imported from <filename> by <actor_pubkey>"`

**Acceptance:** Imported data is time-travelable, audit-ready, and signed (FR-SHATTER-1/2/3).

### 5.2 Arrow-Style Ingestion Pipeline (FR-GRID-ARROW-1)

- Rust-based ingestion worker using Arrow memory layout for bulk CSV parsing
- Zero-copy where possible; stream into yrs without blocking UI thread

**Acceptance:** Bulk import of a 10,000-row CSV doesn't stall UI.

### 5.3 Standard Orbit Export

| Format | Scope | Command |
|---|---|---|
| **Parquet** | Ledger + entities + relationships + schema manifest | `POST /v1/export/parquet` |
| **PDF/A** | Human-readable doc archive with embedded signature/audit IDs | `POST /v1/export/pdfa` |
| **CSV/Sheets** | Any Lens result set, user-chosen scope/time window | `POST /v1/export/csv` |

**Acceptance:** All three export formats work locally; Parquet is partitionable by time/entity (FR-EXPORT-1/2/3).

---

## Non-Functional Targets (Phase A, PRD §12)

| Metric | Target | Verification |
|---|---|---|
| LAN p2p state sync | <10ms (goal <5ms) | Measured via sync latency instrumentation |
| ABAC overhead | <1ms per check | Rust benchmark (`cargo bench`) |
| Cold start | Interactive <1.5s | Tauri app startup timer |
| Widget render | <100ms post store init | Browser performance mark |
| Balance check on post | Pass within tolerance 0.01 | Rust unit test |
| Offline → reconnect sync | Full anchoring, no data loss | Manual scenario test (UC-1) |

---

## Phase A Definition of Done (PRD §15)

- [ ] Warehouse tablet creates inventory movements offline → syncs → cockpit updates without manual reconciliation
- [ ] Any ledger number traceable to signed mutations (signature + timestamp + actor + diff)
- [ ] Time-travel slider reconstructs cockpit state for chosen past timestamp
- [ ] AI outputs Proposals only; every insight supports drill-to-source; no silent finalization
- [ ] Standard Orbit export works locally: Parquet + PDF/A + CSV/Sheets
- [ ] All Phase A NFR benchmarks met on representative SME hardware/LAN

---

## Test Strategy

### Rust Unit Tests (Milestone 1–2 critical path)

```bash
cd src-tauri && cargo test
```

| Test | Invariant |
|---|---|
| `test_tx_post_balance_invariant` | `sum(debits) == sum(credits)` or `ERR_BALANCE_FAIL` |
| `test_invmove_qty_sign` | Receipt positive, issue negative; else `ERR_INVENTORY_EFFECT_MISMATCH` |
| `test_post_requires_approval` | `approved→posted` without approval atom → `ERR_APPROVAL_MISSING` |
| `test_merkle_tamper_detection` | Modified audit entry → chain verify fails |
| `test_replay_protection` | Duplicate `mutation_id` → `ERR_REPLAY_MUTATION_ID`; lamport rewind → `ERR_LAMPORT_REWIND` |
| `test_abac_role_defaults` | Staff denied `posting.create`; finance allowed |
| `test_posting_template_invoice_out` | Generates AR/Revenue/TaxPayable postings correctly |
| `test_status_machine_invalid_transitions` | Skip transitions return `ERR_INVALID_STATUS` |

### TypeScript / Frontend Tests

```bash
npm test
```

| Test | Coverage |
|---|---|
| Grid Lens renders tx lines from Yjs fragments | Reactive update on mutation |
| Cockpit widgets subscribe and update without refresh | FR-COCKPIT-1 |
| Drill-to-source opens correct tx/posting/approval chain | FR-TIME-3 |
| Anchor status badges shown per record | Outbox state UX |

### Manual Scenario Tests (Must-Pass, PRD §15 + ARCHITECTURE §Testing)

| # | Scenario | Steps |
|---|---|---|
| S1 | **Offline warehouse flow** | (1) Disconnect network. (2) Create inventory movement. (3) Restart app — movement persists. (4) Reconnect. (5) Verify anchor status → `anchored`; cockpit updates. |
| S2 | **Post ceremony** | (1) Create `invoice_out` draft. (2) Add line + invmove. (3) Attempt `post_tx` without approval → verify `ERR_APPROVAL_MISSING`. (4) Sign approval. (5) Post → verify `status=posted` and balanced postings. |
| S3 | **Audit drill-down** | (1) Click a ledger total in Cockpit. (2) Verify lineage panel shows: fragment IDs, actor pubkey, `signed_at_ms`, signature, mutation diff. (3) Export evidence bundle. |
| S4 | **Tamper test** | (1) Locate `audit.jsonl`. (2) Edit one entry manually. (3) Restart app — Audit Integrity Badge shows failure. |
| S5 | **Policy change + revocation** | (1) Revoke a user key on Primary. (2) Satellite (offline) attempts mutation. (3) On reconnect, verify envelope is quarantined with `ERR_ABAC_DENY`. |
| S6 | **Shatter import** | (1) Drag a CSV of 100 invoice rows onto Shatter lens. (2) Confirm AI column mapping. (3) Commit — verify fragments created with provenance label and signed. |

---

## Phase B Hooks (Do Not Implement in Phase A)

- Multi-currency (`fx_rate`, `amount_base` fields)
- Lot/serial/bin inventory
- FIFO/Weighted Average valuation engines with checkpoints
- Admin/ops console (key lifecycle, diagnostics, support bundle)
- Optional cloud backup/relay (non-authoritative)
- Materialized rollups (account balances, SOH by item/location)
- Ghost Mode (projected fragment overlays)

---

## Reference Documents

| Document | Role in this plan |
|---|---|
| [PRD.md](./PRD.md) | Source of functional requirements and NFRs |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Component boundaries and data flows |
| [TECHNICAL_BLUEPRINT.md](./TECHNICAL_BLUEPRINT.md) | Mutation envelope, sync, ABAC, plugin runtime |
| [SCHEMA_SPEC.md](./SCHEMA_SPEC.md) | Fragment layout, field definitions, posting rules |
| [SCHEMA_BRIDGE_MAPPING.md](./SCHEMA_BRIDGE_MAPPING.md) | Canonical op patterns and ABAC checks per fragment |
| [API_CONTRACTS.md](./API_CONTRACTS.md) | Endpoint contracts for Rust engine API |
| [SKILLS.md](./SKILLS.md) | Team capability checklist |

---

**Last Updated:** 27 February 2026  
**Version:** Implementation Plan v1 (Phase A Baseline)
