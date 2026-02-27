# Corngr-ERP — Technical Blueprint v1

> **Artifact:** Rust ↔ Yjs Bridge (Antigravity Spine)  
> **Applies to:** Phase A Baseline (Feb 2026), with forward-compat for Phase B hardening + Phase C Marketplace  
> **Core idea:** The Rust engine is the authority for policy + signatures + audit chaining; Yjs/yrs is the collaboration substrate; the Bridge is the mutation pipeline that makes "Signed Reality" true.

---

## 1. Goals & Non-Goals

### 1.1 Goals

| Goal | Description |
|---|---|
| **Signed Reality** | Every state change that matters is cryptographically signed and verifiable. |
| **Local-first correctness** | Actions commit locally; sync is eventual and conflict-free. |
| **Deterministic audit** | Merkle-chained mutation log is the canonical sequence for compliance/time-travel. |
| **Policy enforcement** | ABAC + capabilities enforced in Rust, not in UI. |
| **Plugin-safe extensibility** | WASM plugins and UI Lenses can compute and propose, but cannot bypass signatures/ABAC. |

### 1.2 Non-Goals (v1)

- Perfect global ordering across disconnected nodes (we rely on CRDT convergence + anchored audit chains).
- Cloud as an authority.
- Arbitrary plugin code execution with unlimited access (capability model is mandatory).

---

## 2. System Components (Bridge Context)

### 2.1 Nodes

| Node | Role |
|---|---|
| **Primary Node (Anchor)** | Always-on on SME network; maintains canonical Merkle chain for the org; relays sync to satellites. |
| **Satellite Node** | Laptop/tablet; runs offline; keeps local outbox; syncs later. |

### 2.2 Core Subsystems

| Subsystem | Description |
|---|---|
| **yrs/Yjs Store** | CRDT document store (fragments/atoms) for interactive state and multi-user merges. |
| **Rust Policy & Ledger Engine** | Validates mutations, enforces ABAC/capabilities, signs/accepts mutations, appends to audit chain. |
| **Audit Log** | JSONL append-only, hash-chained, signature-verified mutation ledger. |
| **Sync Transport** | LAN P2P/mesh-friendly (v1: client↔Primary, with hooks for libp2p later). |
| **Plugin Runtime** | WASM sandbox with capability manifest and a narrow host API (Phase C-ready). |

---

## 3. Canonical Data Objects

### 3.1 Fragment Addressing

**`FragmentID`** (stable):
- `entity_type` — e.g., `ledger_entry`, `inventory_move`, `approval`, `doc`, `policy_grant`
- `ulid` — time-sortable unique ID
- `scope` (optional) — org/branch

**Example:** `ledger_entry:01HZY...`

### 3.2 Mutation Envelope *(the heart)*

A mutation is an **intent + diff** applied to one or more fragments, wrapped with signatures and lineage.

#### Envelope Fields (normative)

| Field | Type | Description |
|---|---|---|
| `envelope_version` | string | `"1"` |
| `org_id` | string | Stable org identifier |
| `mutation_id` | ULID | Unique mutation ID |
| `actor_pubkey` | Ed25519 | Actor's public key |
| `device_pubkey` | Ed25519 (opt) | Device identity |
| `issued_at_ms` | int64 | Device wall-clock time |
| `lamport` | uint64 | Per-actor logical clock |
| `prev_hash` | bytes32 | Previous accepted audit entry hash on this node/chain |
| `capability_token_id` | string (opt) | Reference to signed capability grant |
| `ops` | list | Operations (see §3.3) |
| `policy_context` | object | Minimal attributes snapshot for ABAC evaluation (role, device trust, network zone, etc.) |
| `content_hash` | bytes32 | Hash of canonical ops representation |
| `signature` | Ed25519 | Signature over `(envelope_version..content_hash..prev_hash..lamport..issued_at_ms)` |
| `attachments` | object (opt) | e.g., Arrow buffers referenced by hash, or doc deltas |

> **Notes:**
> - `prev_hash` forms the Merkle chain.  
> - `lamport` gives per-actor ordering independent of wall-clock drift.  
> - `content_hash` ensures deterministic signing regardless of JSON formatting.

### 3.3 Operation Types (`ops`)

Minimum op set for v1:

| Op | Fields |
|---|---|
| `map_set` | `{fragment_id, key, value}` |
| `map_del` | `{fragment_id, key}` |
| `array_insert` | `{fragment_id, index, values[]}` |
| `array_delete` | `{fragment_id, index, count}` |
| `text_apply_delta` | `{fragment_id, delta}` — for ProseMirror/Yjs doc deltas |
| `link_add` | `{from_fragment_id, to_fragment_id, rel_type}` — lineage graph lite |
| `proposal_create` | `{proposal_id, proposal_type, target_fragments[], suggested_ops[]}` — AI/plugins default to this |

**Rule:** Ops must be representable as:
1. A deterministic canonical encoding (for signing), and
2. A yrs/Yjs update application (bridge to CRDT).

---

## 4. Mutation Lifecycle (End-to-End)

### 4.1 Local Commit Flow (Satellite or Primary)

> **Goal:** "Works offline" while preserving Signed Reality.

```
User action in UI
  → produces high-level intent (e.g., "receive stock 10 units")
  → UI calls Rust engine: request_mutation(intent, draft_ops)
  → Rust engine:
      1. Resolves/derives final ops (generates IDs, adds lineage links, normalizes values)
      2. Runs ABAC + capability checks
      3. Constructs Mutation Envelope
      4. Signs using actor key
  → Engine applies ops to local yrs store (immediate UX update)
  → Engine appends envelope to local Outbox (pending sync) + local audit log ("locally accepted")
  → UI receives: mutation_accepted { mutation_id, new_head_hash, affected_fragment_ids }
```

> **Key property:** Local accept is instant; global acceptance is synced/anchored later.

### 4.2 Sync + Anchor Flow (Satellite ↔ Primary)

> **Goal:** Converge state and align on the Primary's canonical chain.

```
1. Satellite connects; exchanges heads:
   - Satellite sends: outbox mutation_ids + head_hash
   - Primary returns: canonical_head_hash + missing mutation summaries

2. Satellite uploads pending envelopes not known to Primary.

3. Primary verifies each envelope:
   - Signature valid?
   - ABAC/capability checks valid under Primary's policy?
   - Envelope well-formed + canonical hash matches?
   - Chain linkage (prev_hash) — see §4.4

4. Primary accepts → appends to canonical audit log → applies ops to yrs store → advances canonical head.

5. Primary returns:
   - accepted_mutations[] + new canonical_head_hash
   - rejected_mutations[] with reason codes
   - missing_updates (yrs updates or mutation envelopes Satellite should pull)

6. Satellite:
   - Marks accepted as anchored
   - Applies missing yrs updates (or replays envelopes)
   - For rejected: moves to quarantine + notifies UI with reasons
```

### 4.3 Pull Model for Other Satellites

Satellites can:
- Pull canonical mutation stream since last anchored hash, **or**
- Pull yrs update snapshots/checkpoints (Phase B), then catch-up deltas.

---

## 5. Chain Linkage Strategy (Handling `prev_hash` Offline)

Offline devices cannot know the Primary's latest `prev_hash`. v1 supports **two-stage anchoring**:

### 5.1 Local Chain (Satellite)
Satellite produces envelopes chaining to its local head (`prev_hash = local_head`). This is the local acceptance chain.

### 5.2 Anchored Chain (Primary)
When Primary receives a satellite envelope, it wraps it in an **Anchor Entry**:

| Anchor Entry Field | Description |
|---|---|
| `anchor_prev_hash` | Primary canonical head |
| `satellite_envelope_hash` | Hash of original envelope |
| `anchor_signature` | Primary node key / org key |
| `policy_eval_result` (opt) | Policy evaluation snapshot |

Primary appends Anchor Entry to canonical log. Canonical chain remains linear and verifiable.

> **Result:** The original envelope is the signed "actor intent"; the Anchor Entry binds it into the org's canonical chain.  
> *(Phase B can add "re-signing with org co-sig" or multi-sig for high-risk actions.)*

---

## 6. Signature Verification (Ed25519)

### 6.1 Verification Rules

An envelope is **valid** if:
- `signature` verifies against `actor_pubkey` over canonical bytes
- `content_hash` matches canonical encoding of `ops`
- `mutation_id` is unique within org scope
- `lamport` is monotonic per actor (allow gaps; reject replays)
- Capability token (if present) is valid, unexpired, and signed by an authority key
- ABAC evaluation passes for the requested ops

### 6.2 Replay Protection

Maintain per-actor:
- `max_lamport_seen`
- Optional bloom filter of recent `mutation_ids`

Reject:
- Duplicate `mutation_id`
- `lamport` lower than previously anchored lamport (unless in explicit admin "recovery mode")

---

## 7. ABAC + Capability API (Rust Engine as Gatekeeper)

### 7.1 Two Layers of Authorization

| Layer | Controls |
|---|---|
| **ABAC** | Who can do what, under what conditions |
| **Capabilities** | What a Lens/Plugin is allowed to request programmatically |

**Rule:** Plugins/Lenses never get raw "write state" authority by default. They get:
- **Read access** (scoped)
- **Propose access**
- **Optional limited write** to specific domains if explicitly granted

### 7.2 Capability Manifest (for Marketplace Assets)

A Lens/Plugin must declare:

```json
{
  "asset_id": "...",
  "publisher_pubkey": "...",
  "asset_signature": "...",
  "requested_capabilities": {
    "read": ["inventory", "ledger", "docs", "audit"],
    "write": ["proposal_*"],
    "execute": ["tax_calc", "anomaly_detect", "forecast"],
    "data_retention": { "local_only": true },
    "network": false
  }
}
```

**Install flow:**
1. Verify publisher signature
2. Admin approves requested capabilities
3. Create Capability Grant as a signed fragment (time-travelable)
4. Issue `capability_token_id` referencing that grant

### 7.3 Rust Host API (Minimal)

```rust
// Read
query_fragments(query_spec) -> fragments
read_audit_range(from_hash, to_hash) -> entries
resolve_lineage(fragment_id) -> linked_ids

// Propose
create_proposal(proposal_spec) -> proposal_id
attach_suggested_ops(proposal_id, ops[])

// (Optional v1) Limited write — still goes through ABAC + signing
request_mutation(intent, ops_draft, capability_token_id) -> accepted | rejected
```

---

## 8. Sync / Outbox Design

### 8.1 Outbox States

| State | Description |
|---|---|
| `local_accepted` | Signed locally; not yet sent to Primary |
| `sent_to_primary` | Uploaded; awaiting anchor confirmation |
| `anchored` | Accepted into canonical chain |
| `rejected` | Primary rejected for policy/integrity reason |
| `quarantined` | Needs human attention |
| `superseded` | Replaced by a corrected mutation |

### 8.2 Retry + Ordering

- Send in local chain order
- Retry with exponential backoff on LAN disconnect
- UI always reflects local state; anchoring status visible per record (badge)

### 8.3 Conflict Handling (CRDT vs. Policy)

CRDT merges converge state, but policy may still reject writes at anchor time.

**Rule:** If Primary rejects a mutation due to policy:
- Satellite does **not** delete history; it marks as rejected and generates a compensating UI notice.
- *(Phase B)* Auto-generate a compensating proposal or revert via a new signed mutation.

---

## 9. yrs/Yjs Integration Details (Bridge Mechanics)

### 9.1 Apply Ops

Rust engine converts ops → yrs transactions:

| Op | yrs Target |
|---|---|
| `map_set` / `map_del` | `YMap` updates |
| `array_insert` / `array_delete` | `YArray` updates |
| `text_apply_delta` | `YText` / `XmlFragment` updates |

### 9.2 Produce/Consume Yjs Updates

| Phase | Approach |
|---|---|
| **Phase A (simple)** | Replicate envelopes; apply ops deterministically to yrs. |
| **Phase B (scale)** | Checkpoints + Yjs updates for speed, with hash verification. |

> Prefer exchanging mutation envelopes for audit + verification. Optionally exchange Yjs update blobs for fast catch-up (must be validated against envelopes or accepted checkpoints).

---

## 10. Plugin SDK Surface (Phase C-Ready in v1 Shape)

### 10.1 Asset Packaging

```
manifest.json          — capabilities, metadata, version, publisher key
lens_ui/               — React lens descriptor + allowed components
plugin.wasm            — (optional)
signatures             — publisher signature over manifest + wasm hash
```

### 10.2 Lens Descriptor (Declarative)

```json
{
  "lens_id": "...",
  "version": "1.0.0",
  "query_specs": [...],
  "render_mode": "grid | workflow | canvas | webgl",
  "actions": ["create_proposal", "annotate", "request_approval"]
}
```

### 10.3 Plugin Runtime Constraints

- No direct filesystem unless capability granted
- No network unless capability granted
- **No key access, ever**
- CPU/memory quotas configurable (Phase B)

---

## 11. Error Codes (Normative)

#### Signature / Integrity
| Code | Description |
|---|---|
| `ERR_SIG_INVALID` | Envelope signature fails verification |
| `ERR_CONTENT_HASH_MISMATCH` | Ops canonical hash doesn't match declared hash |
| `ERR_REPLAY_MUTATION_ID` | Duplicate mutation ID detected |
| `ERR_LAMPORT_REWIND` | Actor lamport value regressed |

#### Authorization
| Code | Description |
|---|---|
| `ERR_ABAC_DENY` | ABAC policy evaluation denied the operation |
| `ERR_CAPABILITY_MISSING` | Required capability token absent |
| `ERR_CAPABILITY_EXPIRED` | Capability grant has expired |
| `ERR_SCOPE_VIOLATION` | Op targets a fragment outside granted scope |

#### Sync / Topology
| Code | Description |
|---|---|
| `ERR_ANCHOR_CONFLICT` | Chain linkage conflict during sync |
| `ERR_PRIMARY_UNREACHABLE` | No connection to Primary Node |
| `ERR_PARTIAL_ACCEPT` | Some ops in envelope accepted, some denied |

---

## 12. Test Plan (v1 Must-Pass)

| # | Test | Acceptance |
|---|---|---|
| 12.1 | **Offline acceptance** | Create inventory movement offline; restart app; movement persists; outbox persists. |
| 12.2 | **Sync anchoring** | Reconnect; envelope anchors; Primary log advances; Satellite marks anchored. |
| 12.3 | **Tamper detection** | Modify audit JSONL entry; integrity badge fails; verification returns error. |
| 12.4 | **Policy rejection** | Staff attempts to write financial fragment; local engine denies OR Primary rejects; mutation quarantined with reason code. |
| 12.5 | **Drill-to-source** | From Cockpit anomaly → linked fragment IDs → mutation envelope → signatures displayed. |
| 12.6 | **Plugin capability enforcement** | Install plugin requesting financial read; deny; verify cannot read. Approve; verify it can read but only propose changes. |

---

## 13. Implementation Notes (Pragmatic v1 Choices)

1. Start with **client↔Primary sync channel** (simple); design message formats so you can swap in libp2p later.
2. Make the **audit log canonical** and derive time-travel from it; introduce checkpoints in Phase B.
3. Keep plugin execution **proposal-only** in Phase A/B unless explicitly granted and tightly scoped.
4. Treat **anchoring as a first-class status**, not an afterthought — surface it in UI where it matters (badge per record).

---

## 14. Deliverables Checklist (Engineering)

- [ ] Canonical encoding for mutation envelopes (hash + signature stable)
- [ ] Rust engine: ABAC evaluator + capability grants + signer/verifier
- [ ] yrs apply-op layer and deterministic op mapping
- [ ] Outbox persistence + retry logic
- [ ] Primary anchoring service + canonical audit log
- [ ] Satellite sync client + quarantine handling
- [ ] UI drill-to-source viewer for envelope + signature + policy result
- [ ] Plugin manifest + verification + capability prompt + host API (read/propose)

---

*See also: [PRD.md](./PRD.md) · [SKILLS.md](./SKILLS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)*
