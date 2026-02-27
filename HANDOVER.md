# Corngr-ERP — Session Handover

> **Session date:** 27 February 2026  
> **Codename:** Antigravity  
> **Repo:** [github.com/kirk-dot-com/corngr-erp](https://github.com/kirk-dot-com/corngr-erp)  
> **Branch:** `main`

---

## What Was Achieved This Session

### The Pivot

This session established the complete strategic and technical foundation for **Corngr-ERP** — a pivot from a post-file OS prototype to a fully specified AI-native, local-first ERP-Grid for SMEs. The Corngr core (Yjs/yrs CRDTs, Tauri/Rust, Ed25519, Merkle log) became the backbone of an ERP product with three unfair advantages over legacy systems: Single Source of Truth, IRAP-ready cryptographic trust, and AI-native living data.

### Reference Documents Created & Pushed

All nine documents are live on `main` at `kirk-dot-com/corngr-erp`:

| Document | Purpose |
|---|---|
| [README.md](./README.md) | Repo landing page — ERP-Grid pivot, three unfair advantages, feature mapping, phase scope |
| [PRD.md](./PRD.md) | Product Requirements Document v1.0 — 16 sections covering all FRs, NFRs, use cases, personas, data model, and Phase A DoD |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture v1 — component diagram (Mermaid), 4 sequence flows, security model, threat model, performance targets |
| [TECHNICAL_BLUEPRINT.md](./TECHNICAL_BLUEPRINT.md) | Rust↔Yjs Bridge engineering spec — mutation envelope structure, local commit flow, sync/anchor flow, ABAC API, plugin runtime, error codes |
| [SCHEMA_SPEC.md](./SCHEMA_SPEC.md) | Universal Transaction Atom & Master Ledger Schema v1 — fragment layout for all 8 entity types, posting rules, status model, inventory↔ledger linkage contract |
| [SCHEMA_BRIDGE_MAPPING.md](./SCHEMA_BRIDGE_MAPPING.md) | Schema-to-Bridge Mapping v1 — canonical op patterns (TX.HDR, TX.LINE, INV.MOVE, POSTING, APPROVAL) with ABAC checks, composite lifecycle flows |
| [API_CONTRACTS.md](./API_CONTRACTS.md) | Rust engine API Contracts v1 — 12 endpoints with full request/response shapes, ABAC conditions, error codes, and implementation notes |
| [SKILLS.md](./SKILLS.md) | ERP-Grid Skills Matrix — 7 capability domains: Orbital Architecture, Agentic Intelligence, Unified Data Grid, Cryptographic Trust, SME Domain Lenses, HITL UX, Gravity Well ingestion |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Phase A implementation plan — 5 milestones, engineering tasks, Rust/TS test strategy, 6 manual scenario tests, NFR targets, Phase A DoD |
| [ADR-0001.md](./ADR-0001.md) | Architecture Decision Record — Phase A defaults: CoA templates, CAIO model size, Primary Node form factor, partial fulfillment policy, site_id phasing |

### Git History (This Session)

```
3208646  docs: add Implementation Plan v1 (Phase A)
2eec9a0  docs: update README for Corngr-ERP pivot
29c2e11  docs: add API Contracts v1 for Rust engine
037b012  docs: add schema reference documents
de38228  docs: add Corngr-ERP system reference documents
```

---

## Where We Start Next (Milestone 1)

The implementation begins with **Milestone 1: Universal Transaction Atom & Master Ledger** — the keystone that all Lenses, AI proposals, and audit flows depend on. Nothing else can be built until shared fragment truth exists.

### First Tasks (M1.1 — Fragment Schema in yrs)

**Location:** `src-tauri/src/` (Rust) + `src/` (TypeScript/React)

The very first pull request should establish the yrs fragment structure for the core entities. Start here:

#### Step 1 — Define fragment ID conventions (Rust)

Create `src-tauri/src/fragments.rs`:
```rust
// Fragment ID patterns
// tx:{tx_id}:hdr
// tx:{tx_id}:lines
// txline:{tx_line_id}
// posting:{posting_id}
// invmove:{move_id}
// approval:{approval_id}
// account:{account_id}
// party:{party_id}
// org:{org_id}:indexes

pub fn tx_hdr_id(tx_id: &str) -> String {
    format!("tx:{}:hdr", tx_id)
}
// ... etc
```

#### Step 2 — Implement `create_tx` engine function

This is the first API endpoint from API_CONTRACTS.md. It must:
1. Validate `tx_type` against the allowed enum
2. Run ABAC check: `tx.create` on domain `tx`
3. Build ops: `TX.HDR.CREATE` pattern from SCHEMA_BRIDGE_MAPPING.md §2.1
4. Construct and sign `MutationEnvelope`
5. Apply ops to local yrs store
6. Append to local audit JSONL
7. Enqueue to outbox
8. Return `EngineResult.ok` with `TxRef`

#### Step 3 — Write the first Rust unit tests

```rust
#[test]
fn test_tx_hdr_create_draft() { ... }

#[test]
fn test_abac_denies_auditor_tx_create() { ... }

#[test]
fn test_mutation_envelope_signs_and_verifies() { ... }
```

#### Step 4 — Wire `add_line` + `create_invmove`

Once `create_tx` is green, layer in line and inventory move creation with the inventory linkage contract:
- `txline.item_id` must match `invmove.item_id`
- `qty_delta` sign must match `inventory_effect`
- `txline.move_ids[]` updated on each `create_invmove`

---

### Milestone Sequence (Recommended Order)

```
M1 Fragment schema + Ledger engine  →  M2 ABAC + Ed25519 signing
       ↓
M3 Cockpit prototype + CAIO         →  M4 Time Machine + audit explorer
       ↓
M5 Shatter import + Orbit export
```

M1 and M2 are tightly coupled — signing requires the envelope format, and the envelope is built on ops that depend on the fragment schema. Build them together in the first sprint.

M3 can begin its React scaffold (Cockpit shell, widget placeholders) in parallel with M1/M2 Rust work.

---

## Key Decisions Already Made

*Phase A baseline decisions are formally recorded in [ADR-0001.md](./ADR-0001.md).*

| Decision | Rationale |
|---|---|
| Fragment IDs use ULIDs | Time-sortable + unique; avoids UUID collision without coordination |
| `prev_hash` uses two-stage anchoring | Satellites can't know Primary's latest hash offline; Anchor Entry binds them later |
| Plugins are proposal-only in Phase A | No arbitrary write authority until capability model is fully hardened (Phase B) |
| Postings are engine-generated, not UI-authored | Guarantees canonical ledger integrity; UI supplies drafts, engine overwrites |
| Tombstone preferred over hard delete | Preserves audit trail for lines/postings; yrs CRDT-friendly |
| AI outputs only `proposal_create` ops | Human-in-the-loop finality is non-negotiable for financial state (FR-AI-4) |
| `rounding_tolerance = 0.01` on balance check | Practical SME accounting tolerance; configurable in Phase B |
| **CoA: ship with templates** (ADR-0001 §1) | Minimizes onboarding friction; templates are editable fragments |
| **CAIO model: 3B–4B instruct** (ADR-0001 §2) | Deployable on SME hardware; reliability from constraints not parameters |
| **Primary Node: in-app toggle** (ADR-0001 §3) | Lowest-friction for office PC/Mac mini; headless daemon deferred to Phase B |
| **Partial fulfillment: explicit policy-gated** (ADR-0001 §4) | Matches SME reality; prevents finance↔warehouse ERP drift |
| **`site_id` included in Phase A schema** (ADR-0001 §5) | Cheap to add now; forward-compatible; full multi-site in Phase B |

---

## Open Questions

> All five open questions from the previous session have been resolved and formally recorded in **[ADR-0001.md](./ADR-0001.md)** (accepted 2026-02-27).

| # | Question | Resolution |
|---|---|---|
| 1 | CoA seed data | Ship three templates (General SME / Services / Product+Mfg); blank behind Advanced toggle |
| 2 | Local LLM model/size | 3B–4B instruct via Candle/llama-edge; Fast/Balanced/Powerful UI tiers |
| 3 | Primary Node deployment | In-app "Primary Node Mode" toggle (Phase A); headless daemon + Docker in Phase B |
| 4 | Partial fulfillment policy | Allowed with explicit validation; hard qty invariants; "Partial" badges in UX |
| 5 | Multi-site scope (`branch_id`/`site_id`) | Optional fields in Phase A schema (default `"primary"`); full multi-site in Phase B |

---

## Quick Reference: Error Codes to Implement First

These are the must-have codes for M1 + M2:

`ERR_ABAC_DENY` · `ERR_INVALID_TX_TYPE` · `ERR_INVALID_STATUS` · `ERR_INVALID_FIELD` · `ERR_VALIDATION_FAIL` · `ERR_BALANCE_FAIL` · `ERR_APPROVAL_MISSING` · `ERR_ITEM_MISMATCH` · `ERR_INVENTORY_EFFECT_MISMATCH` · `ERR_MOVE_QTY_EXCEEDS` · `ERR_SIG_INVALID` · `ERR_REPLAY_MUTATION_ID` · `ERR_LAMPORT_REWIND` · `ERR_POSTINGS_MISSING` · `ERR_LINE_IMMUTABLE`

---

*Handover prepared: 27 February 2026. Next session: begin Milestone 1 implementation.*
