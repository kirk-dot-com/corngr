# Corngr-ERP — Schema-to-Bridge Mapping v1

> **Purpose:** Define the exact mutation op patterns (Yjs/yrs ops) for each fragment type and the required ABAC checks so the Rust↔Yjs Bridge and Ledger Engine can be implemented together.  
> **Scope:** Phase A baseline (`hdr`/`lines`/`postings`/`invmoves`/`approvals` + indexes), with forward hooks for Phase B.

---

## 0. Foundations (Normative)

### 0.1 Canonical Op Primitives (Bridge v1)

All schema mutations compile to these op types (from the Bridge spec):

| Op | Signature |
|---|---|
| `map_set` | `(fragment_id, key, value)` |
| `map_del` | `(fragment_id, key)` |
| `array_insert` | `(fragment_id, index, values[])` |
| `array_delete` | `(fragment_id, index, count)` |
| `text_apply_delta` | `(fragment_id, delta)` — docs only |
| `link_add` | `(from_fragment_id, to_fragment_id, rel_type)` — lineage lite |
| `proposal_create` | `(proposal_id, proposal_type, target_fragments[], suggested_ops[])` |

### 0.2 Mutation Modes

| Mode | Description |
|---|---|
| **Direct** | Human UI write; engine signs and applies |
| **Proposal-only** | AI/plugin writes; must create `proposal:*` atoms; cannot finalize or post |
| **Engine-derived** | Ledger engine generates postings/invmoves from a TxAtom and applies them |

> **Rule:** In Phase A, plugins/AI default to **proposal-only**.

### 0.3 Status Gates (engine enforced)

- Editing rules depend on `tx:{id}:hdr.status`
- `posted` is **immutable** — no direct edits to `hdr`/`lines`/`postings`/`invmoves`
- Changes to posted truth occur via **reversal tx** (new TxAtom only)

---

## 1. ABAC: Canonical Permissions & Checks

### 1.1 Attribute Set

ABAC evaluates: `role` · `device_trust` · `network_zone` · `time_window` · `tx_type` · `tx_status` · `amount` · `domain` · `action`

### 1.2 Roles (Phase A defaults)

`owner_admin` · `manager` · `finance` · `staff` · `auditor` *(read-only)*

### 1.3 Actions

| Domain | Actions |
|---|---|
| Transactions | `tx.create`, `tx.edit`, `tx.status.transition` |
| Lines | `txline.create`, `txline.edit`, `txline.delete` |
| Postings | `posting.create`, `posting.edit`, `posting.finalize` |
| Inventory | `invmove.create`, `invmove.edit`, `invmove.finalize` |
| Approvals | `approval.create`, `approval.sign` |
| System | `index.update`, `proposal.create` |

### 1.4 Core ABAC Policies (Normative)

| Policy | Allowed Roles | Denied | Condition |
|---|---|---|---|
| **P1** Create/Edit Draft Tx | `staff`, `manager`, `finance` | `auditor` | `tx_status ∈ {draft, proposed}` |
| **P2** Postings create/finalize | `finance` (drafts); `manager` below threshold | `staff` | — |
| **P3** Inventory movements | `staff`, `manager`, `finance` | — | `tx not posted` |
| **P4** Post (`approved→posted`) | `finance`, `manager` under threshold | — | Requires `post` approval atom with valid sig |
| **P5** Reverse | `finance`, `manager` under threshold | — | Requires reverse approval; new reversal tx |
| **P6** Index updates | **Engine-only** | UI/Plugins | — |

---

## 2. Standard Op Patterns (Per Fragment Type)

> **Pattern format:**  
> **Inputs** — required identifiers/fields  
> **Ops** — ordered canonical ops  
> **ABAC required** — checks engine must pass before signing/applying  
> **Notes** — invariants / derived fields / index side-effects

---

### 2.1 Tx Header — `tx:{tx_id}:hdr`

#### Pattern: `TX.HDR.CREATE`
*Create new TxAtom header (draft)*

**ABAC:** `tx.create` on domain `tx` (P1)

```
1.  map_set(tx:{tx_id}:hdr, "tx_id",           tx_id)
2.  map_set(tx:{tx_id}:hdr, "org_id",           org_id)
3.  map_set(tx:{tx_id}:hdr, "tx_type",          tx_type)
4.  map_set(tx:{tx_id}:hdr, "status",           "draft")
5.  map_set(tx:{tx_id}:hdr, "created_at_ms",    now_ms)
6.  map_set(tx:{tx_id}:hdr, "effective_at_ms",  effective_at_ms)
7.  map_set(tx:{tx_id}:hdr, "currency",         currency)
8.  map_set(tx:{tx_id}:hdr, "parties",          {...})
9.  map_set(tx:{tx_id}:hdr, "memo",             memo?)

// Engine-only index ops:
10. array_insert(org:{org_id}:indexes.tx_by_time,          end, [tx_id])
11. array_insert(org:{org_id}:indexes.tx_by_type:{tx_type}, end, [tx_id])
12. array_insert(org:{org_id}:indexes.tx_by_party:{party},  end, [tx_id])  // optional
```

> **Note:** Store `parties` as inline JSON map in `hdr` (simpler), or as separate `tx:{tx_id}:parties` fragment (more CRDT-granular). v1 recommendation: separate fragment only if heavy concurrent edits expected; otherwise inline.

---

#### Pattern: `TX.HDR.EDIT`
*Update memo, refs, parties, effective date (draft/proposed only)*

**ABAC:** `tx.edit` (P1), `status ∈ {draft, proposed}`

```
map_set(tx:{tx_id}:hdr, "memo",             new_memo)
map_set(tx:{tx_id}:hdr, "effective_at_ms",  new_effective_at_ms)
map_set(tx:{tx_id}:hdr, "refs",             refs_obj)
```

> If `status=approved`, only limited fields (e.g., `memo`) may be editable per policy.

---

#### Pattern: `TX.HDR.TRANSITION`
*Status changes: `draft→proposed`, `proposed→approved`, `approved→posted`, `posted→reversed/void`*

**ABAC:** `tx.status.transition` with policy gates (P4/P5)

```
map_set(tx:{tx_id}:hdr, "status",            new_status)
map_set(tx:{tx_id}:hdr, "status_changed_at_ms", now_ms)
map_set(tx:{tx_id}:hdr, "status_reason",     "...")  // optional
```

**Additional requirements by transition:**

| Transition | Additional requirement |
|---|---|
| `draft → proposed` | None beyond P1 |
| `proposed → approved` | Requires `approval` atom(s) of type `approve` meeting policy |
| `approved → posted` | Requires `post` approval + balanced postings + inventory linkage satisfied |
| `posted → reversed` | Must create reversal tx (separate pattern); never edit posted tx |

---

### 2.2 Tx Lines — `tx:{tx_id}:lines` + `txline:{tx_line_id}`

#### Pattern: `TX.LINE.CREATE`
*Add a business line to a transaction*

**ABAC:** `txline.create` + `tx.edit` (P1), `tx_status ∈ {draft, proposed}`

```
1.  map_set(txline:{line_id}, "tx_line_id",       line_id)
2.  map_set(txline:{line_id}, "tx_id",            tx_id)
3.  map_set(txline:{line_id}, "line_type",        line_type)
4.  map_set(txline:{line_id}, "description",      desc)
5.  map_set(txline:{line_id}, "qty",              qty)
6.  map_set(txline:{line_id}, "uom",              uom)
7.  map_set(txline:{line_id}, "unit_price",       unit_price)
8.  map_set(txline:{line_id}, "tax_code",         tax_code)
9.  map_set(txline:{line_id}, "net_amount",       net)
10. map_set(txline:{line_id}, "tax_amount",       tax)
11. map_set(txline:{line_id}, "gross_amount",     gross)

// If item affects inventory:
12. map_set(txline:{line_id}, "item_id",          item_id)
13. map_set(txline:{line_id}, "inventory_effect", increase|decrease|reserved)
14. map_set(txline:{line_id}, "move_ids",         [])

// Link into tx:
15. array_insert(tx:{tx_id}:lines, end, [line_id])
```

> **Note:** Amount fields may be engine-derived from `qty`/`unit_price`/tax rules. UI provides draft values; engine overwrites with canonical computed amounts via signed mutation.

---

#### Pattern: `TX.LINE.EDIT`
*Modify qty, price, description pre-posting*

**ABAC:** `txline.edit` + `tx.edit` (P1), `tx_status ∈ {draft, proposed}`

```
map_set(txline:{line_id}, "qty",          new_qty)
map_set(txline:{line_id}, "unit_price",   new_price)
map_set(txline:{line_id}, "net_amount",   new_net)
map_set(txline:{line_id}, "tax_amount",   new_tax)
map_set(txline:{line_id}, "gross_amount", new_gross)
```

> **Invariant:** If inventory-linked moves already exist, edits must either block changes below already-moved qty or require compensating inventory moves via proposal.

---

#### Pattern: `TX.LINE.DELETE`
*Remove line (draft/proposed only; no anchored moves/postings)*

**ABAC:** `txline.delete` + `tx.edit` (P1)

```
array_delete(tx:{tx_id}:lines, index_of(line_id), 1)

// Preferred: tombstone rather than hard delete
map_set(txline:{line_id}, "status",     "deleted")
map_set(txline:{line_id}, "deleted_at_ms", now_ms)
```

---

### 2.3 Inventory Moves — `invmove:{move_id}` + txline linkage

#### Pattern: `INV.MOVE.CREATE`
*Receipt/issue/adjustment linked to a tx line*

**ABAC:** `invmove.create` + `tx.edit` (P3), `tx_status ∈ {draft, proposed, approved}` (configurable)

```
1.  map_set(invmove:{move_id}, "move_id",          move_id)
2.  map_set(invmove:{move_id}, "tx_id",            tx_id)
3.  map_set(invmove:{move_id}, "tx_line_id",       tx_line_id)
4.  map_set(invmove:{move_id}, "item_id",          item_id)
5.  map_set(invmove:{move_id}, "location_id",      location_id)
6.  map_set(invmove:{move_id}, "qty_delta",        qty_delta)
7.  map_set(invmove:{move_id}, "uom",              uom)
8.  map_set(invmove:{move_id}, "effective_at_ms",  effective_at_ms)
9.  map_set(invmove:{move_id}, "valuation_method", method)
10. map_set(invmove:{move_id}, "unit_cost",        unit_cost_or_null)
11. map_set(invmove:{move_id}, "value_delta",      value_delta_or_null)

// Link into txline:
12. array_insert(txline:{tx_line_id}.move_ids, end, [move_id])

// Engine-only index:
13. array_insert(org:{org_id}:indexes.inventory_moves_by_item:{item_id}, end, [move_id])
```

**Invariant checks (engine):**
- `item_id` must match `txline.item_id`
- Sign of `qty_delta` must match `inventory_effect` (`increase` → positive; `decrease` → negative)
- Sum of `qty_delta` across moves must not exceed line `qty` unless policy allows overshipment/overreceipt

> **Phase A valuation:** Compute `unit_cost`/`value_delta` at receipt; on issue use last-known or simple weighted average.

---

#### Pattern: `INV.MOVE.EDIT` *(rare; pre-posting only)*

**ABAC:** `invmove.edit` — manager/finance only  
**Recommendation:** Prefer compensating moves over edits.

---

#### Pattern: `INV.MOVE.FINALIZE`
*Lock inventory move valuation on tx post*

**ABAC:** Executed as part of `tx.post` flow

```
map_set(invmove:{move_id}, "finalized",       true)
map_set(invmove:{move_id}, "finalized_at_ms", now_ms)
map_set(invmove:{move_id}, "unit_cost",       computed_cost)
map_set(invmove:{move_id}, "value_delta",     computed_value)
```

---

### 2.4 Postings — `posting:{posting_id}` + postings array on tx

#### Pattern: `POSTING.DRAFT.CREATE` *(engine-derived)*
*Generate postings as drafts/proposals before final post*

**ABAC:** `posting.create` (P2) — finance; manager under threshold may be allowed

```
1.  map_set(posting:{pid}, "posting_id",     pid)
2.  map_set(posting:{pid}, "tx_id",          tx_id)
3.  map_set(posting:{pid}, "account_id",     account_id)
4.  map_set(posting:{pid}, "direction",      debit|credit)
5.  map_set(posting:{pid}, "amount",         amount)
6.  map_set(posting:{pid}, "currency",       currency)
7.  map_set(posting:{pid}, "effective_at_ms", effective_at_ms)
8.  map_set(posting:{pid}, "party_id",       party_id?)
9.  map_set(posting:{pid}, "line_ref",       tx_line_id?)
10. map_set(posting:{pid}, "posting_group",  group)
11. map_set(posting:{pid}, "status",         "draft")

// Link into tx:
12. array_insert(tx:{tx_id}:postings, end, [pid])

// Engine-only index:
13. array_insert(org:{org_id}:indexes.postings_by_account:{account_id}, end, [pid])
```

> **AI/plugins:** Must not create postings directly. Create a `proposal` that suggests posting ops instead.

---

#### Pattern: `POSTING.FINALIZE`
*Mark postings immutable once tx posted*

**ABAC:** Executed under `tx.post` flow

```
map_set(posting:{pid}, "status",           "final")
map_set(posting:{pid}, "finalized_at_ms",  now_ms)
```

**Invariant checks (engine):**
- `sum(debits) == sum(credits)` within tolerance
- All required accounts resolved
- If inventory effects exist, `Inventory`/`COGS` postings align with `invmoves`

---

#### Pattern: `POSTING.EDIT` *(discouraged)*

Allowed only while `tx not posted` and postings are `draft`. Prefer regenerating postings from business lines.

---

### 2.5 Approvals — `approval:{approval_id}` + index link

#### Pattern: `APPROVAL.CREATE_AND_SIGN`
*Create approval atom referencing a signature in the audit log*

**ABAC:** `approval.create` + `approval.sign` — role by type:

| Approval type | Allowed roles |
|---|---|
| `approve` | `manager`, `finance` |
| `post` | `finance` (or `manager` under threshold) |
| `reverse` | `finance` |

```
1. map_set(approval:{aid}, "approval_id",        aid)
2. map_set(approval:{aid}, "tx_id",              tx_id)
3. map_set(approval:{aid}, "approval_type",      approve|post|reverse|void|pay)
4. map_set(approval:{aid}, "required_policy_id", policy_id)
5. map_set(approval:{aid}, "actor_pubkey",       actor_pubkey)
6. map_set(approval:{aid}, "signed_at_ms",       now_ms)
7. map_set(approval:{aid}, "signature_ref",      audit_entry_ref)
8. map_set(approval:{aid}, "result",             "approved")

// Engine-only index:
9. array_insert(org:{org_id}:indexes.approvals_by_tx:{tx_id}, end, [aid])
```

> `signature_ref` points to the audit entry hash/ID. The approval mutation itself is also signed like any other mutation.

---

## 3. Composite Flows (Transaction Lifecycle as Op Bundles)

### 3.1 `Draft → Proposed`

**ABAC:** `tx.status.transition` (P1)

```
TX.HDR.TRANSITION(status="proposed")
```

### 3.2 `Proposed → Approved`

**ABAC:** `approval.create/sign` then `tx.status.transition`

```
APPROVAL.CREATE_AND_SIGN(approval_type="approve")
TX.HDR.TRANSITION(status="approved")
```

### 3.3 `Approved → Posted` *(the "Post" ceremony)*

**ABAC:** `finance`/`manager` threshold; requires `post` approval atom

**Pre-checks (engine):**
- Tx has required lines
- Postings exist or can be generated
- Postings balance (`sum debits == sum credits`)
- Inventory linkage satisfied (moves exist, or policy allows backorder)

**Recommended op sequence:**

```
1. APPROVAL.CREATE_AND_SIGN(approval_type="post")
2. POSTING.DRAFT.CREATE(...)         // if not already created or regen required
3. INV.MOVE.FINALIZE(...)            // compute valuation for linked moves
4. POSTING.FINALIZE(...)             // all postings
5. TX.HDR.TRANSITION(status="posted")
```

> **Why this order:** Approvals first → derived truth finalization → status flip.

### 3.4 Reverse Posted Transaction

**ABAC:** `finance`; requires reverse approval; creates new tx

```
1. TX.HDR.CREATE(tx_reversal)
2. Create reversal postings (mirror amounts, opposite direction)
3. map_set(tx:{rev}:hdr, "refs.reverses_tx_id", original_tx_id)
4. APPROVAL.CREATE_AND_SIGN(approval_type="reverse")
5. POSTING.FINALIZE(reversal)
6. TX.HDR.TRANSITION(reversal.status="posted")

// Optionally mark original (original remains immutable):
7. TX.HDR.TRANSITION(original.status="reversed")
```

---

## 4. Engine vs. UI Responsibilities

### 4.1 UI May Supply Drafts; Engine Decides Canonical

| Item | Notes |
|---|---|
| Line `net`/`tax`/`gross` amounts | Engine may overwrite draft values |
| Posting templates + account mapping | Engine generates/validates |
| Valuation (`unit_cost`/`value_delta`) | Engine computes canonically |

### 4.2 Engine-Only Writes

- Index updates (`org:{org}:indexes.*`)
- Posting generation/finalization
- Valuation finalization for posted moves
- Status transitions to `posted`
- Capability grant fragments (marketplace)

---

## 5. ABAC Quick Reference Table

| Pattern | Required action | Typical roles | Hard condition |
|---|---|---|---|
| `TX.HDR.CREATE` | `tx.create` | staff/manager/finance | — |
| `TX.HDR.EDIT` | `tx.edit` | staff/manager/finance | `status ∈ {draft, proposed}` |
| `TX.HDR.TRANSITION draft→proposed` | `tx.status.transition` | staff/manager/finance | `status=draft` |
| `APPROVAL (approve)` | `approval.sign` | manager/finance | `tx_status=proposed` |
| `TX.HDR.TRANSITION proposed→approved` | `tx.status.transition` | manager/finance | approval exists |
| `POSTING.DRAFT.CREATE` | `posting.create` | finance (manager<thresh) | `tx_status ∈ {proposed, approved}` |
| `INV.MOVE.CREATE` | `invmove.create` | staff/manager/finance | `line_type=item`; `status≠posted` |
| `INV.MOVE.FINALIZE` | `invmove.finalize` | finance | In post flow only |
| `APPROVAL (post)` | `approval.sign` | finance (manager<thresh) | `tx_status=approved` |
| `TX.HDR.TRANSITION approved→posted` | `tx.status.transition` | finance | approvals + balanced postings |
| `POSTING.FINALIZE` | `posting.finalize` | finance | In post flow only |
| Reverse flow | `tx.reverse` + `approval.sign` | finance | `original.status=posted` |

---

## 6. Deterministic Canonical Ordering of Ops (for signing)

Within a single mutation envelope, ops must be ordered to avoid divergent signatures:

```
1. Create fragments (hdr/line/posting/move/approval) via map_set
2. Link fragments into arrays (tx lines/postings/move_ids/indexes)
3. Finalization flags (status, finalized)
4. Index updates (engine-only, always last)
```

> Keys within a `map_set` payload must be canonicalized (sorted) before hashing.

---

## 7. Implementation Notes (yrs specifics)

- **Prefer tombstoning** (`status=deleted`) over hard delete for lines and postings — preserves audit traceability
- **Separate fragments** for sub-maps expected to receive concurrent edits (CRDT friendliness)
- **Keep rollups out of base atoms** — Phase A: compute-on-read; Phase B: checkpoints/materialized rollups

---

## 8. Minimal "Must Implement" Set (Phase A)

Engineering can start with these patterns immediately:

- [ ] `TX.HDR.CREATE` / `EDIT` / `TRANSITION` (`draft→proposed→approved→posted`)
- [ ] `TX.LINE.CREATE` / `EDIT` / tombstone
- [ ] `INV.MOVE.CREATE` + link to `txline`
- [ ] `POSTING.DRAFT.CREATE` + `POSTING.FINALIZE`
- [ ] `APPROVAL.CREATE_AND_SIGN`
- [ ] Engine-only index maintenance
- [ ] Post ceremony (`Approved→Posted`) pre-checks and invariant enforcement

---

*See also: [SCHEMA_SPEC.md](./SCHEMA_SPEC.md) · [TECHNICAL_BLUEPRINT.md](./TECHNICAL_BLUEPRINT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRD.md](./PRD.md)*

**Last Updated:** 27 February 2026  
**Version:** Schema-to-Bridge Mapping v1 (Phase A Baseline)
