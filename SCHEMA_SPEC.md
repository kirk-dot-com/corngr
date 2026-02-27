# Corngr-ERP — Universal Transaction Atom & Master Ledger Schema Spec v1

> **Codename:** Antigravity  
> **Scope:** Phase A baseline schema (with Phase B hardening hooks)  
> **Storage model:** Unified Data Grid (Yjs/yrs fragments); no database-first metaphor  
> **Truth model:** Signed Mutations + Merkle-chained log anchor the ledger; schema is fragment-addressable and Lens-friendly.

---

## 1. Design Goals (Schema-Level)

| Goal | Description |
|---|---|
| **Atomic Data Integrity** | Inventory, sales, and accounting are different Lenses over the same atoms. |
| **Double-entry correctness** | Every posted transaction balances (sum debits = sum credits). |
| **Post-file composability** | Everything is addressable fragments; Lenses query and render. |
| **Offline-first** | Atoms can be created locally and later anchored; no central coordinator needed to "work." |
| **Audit-ready lineage** | Any number can drill to signed mutations, postings, approvals, and source docs. |
| **Policy-friendly** | Approvals and posting rules are first-class atoms, not "workflow glue." |

---

## 2. Canonical Concepts

### 2.1 Transaction Atom (TxAtom)

A **TxAtom** is the smallest unit of business truth that can be: proposed · approved · posted (finalized) · reversed · traced.

A TxAtom has:
- **Header** — intent, parties, dates, status
- **Lines** — business lines (items/services/charges)
- **Postings** — double-entry lines (accounts, debits/credits)
- **Links** — inventory movements, documents, approvals, provenance

### 2.2 Separation of Concerns *(critical)*

| Layer | Describes |
|---|---|
| **Business Lines** | What happened (items, quantities, prices) |
| **Postings** | How it hits the ledger (accounts, debits/credits) |
| **Inventory Movements** | Physical state change (qty/location/lots) |

These are **linked — not duplicated** — and remain consistent because they reference the same TxAtom.

---

## 3. Fragment Layout (Yjs Structures)

> **Notation:** Each entity is a `Y.Map` keyed by stable IDs (ULID). Collections are `Y.Array` of IDs + index fragments for fast Lens queries.

### 3.1 Master Indexes (org scope)

**Fragment:** `org:{org_id}:indexes` (`Y.Map`)

| Index | Type | Description |
|---|---|---|
| `tx_by_time` | `Y.Array` | `tx_id` (time-sorted ULIDs) |
| `tx_by_party:{party_id}` | `Y.Array` | `tx_id` |
| `tx_by_type:{type}` | `Y.Array` | `tx_id` (invoice, bill, receipt, adjustment) |
| `postings_by_account:{account_id}` | `Y.Array` | `posting_id` |
| `inventory_moves_by_item:{item_id}` | `Y.Array` | `move_id` |
| `approvals_by_tx:{tx_id}` | `Y.Array` | `approval_id` |

> **Phase B hook:** Allow incremental/materialized indexes and checkpoints.

---

## 4. Core Entities & Required Fields

### 4.1 Tx Header Fragment

**Fragment:** `tx:{tx_id}:hdr` (`Y.Map`)

#### Required

| Field | Type | Notes |
|---|---|---|
| `tx_id` | ULID | Redundant but useful |
| `tx_type` | enum | `invoice_out`, `invoice_in`, `payment_in`, `payment_out`, `stock_receipt`, `stock_issue`, `stock_adjust`, `journal`, `credit_note`, `debit_note`, `payroll_stub` *(Phase B)* |
| `status` | enum | `draft`, `proposed`, `approved`, `posted`, `reversed`, `void` |
| `org_id` | string | — |
| `created_at_ms` | int64 | — |
| `effective_at_ms` | int64 | Business effective time |
| `currency` | string | ISO 4217 |
| `parties` | `Y.Map` | `customer_id` / `vendor_id` / `employee_id` as relevant |
| `source_doc_ids` | `Y.Array` | Doc IDs; optional but strongly recommended |
| `memo` | string | — |

#### Recommended

| Field | Type | Notes |
|---|---|---|
| `refs` | `Y.Map` | `external_ref`, `invoice_number`, `po_number`, `shipment_ref` |
| `terms` | `Y.Map` | `due_at_ms`, `payment_terms_code` |
| `tags` | `Y.Array` | — |
| `branch_id` / `site_id` | string | If multi-site |

> **Invariant:** Status transitions must be enforced by the Rust policy engine, not the UI.

---

### 4.2 Tx Business Lines

**Fragment:** `tx:{tx_id}:lines` (`Y.Array` of `tx_line_id`)  
**Fragment:** `txline:{tx_line_id}` (`Y.Map`)

#### Required

| Field | Type | Notes |
|---|---|---|
| `tx_line_id` | ULID | — |
| `tx_id` | ULID | Parent tx |
| `line_type` | enum | `item`, `service`, `tax`, `discount`, `shipping`, `fee`, `note` |
| `description` | string | — |
| `qty` | decimal | Can be 1 for services |
| `uom` | string | e.g. `EA`, `HRS`, `KG` |
| `unit_price` | decimal | In tx currency |
| `net_amount` | decimal | `qty × unit_price − discounts` |
| `tax_code` | string | e.g. `GST10`, `GSTFREE` |
| `tax_amount` | decimal | — |
| `gross_amount` | decimal | `net + tax` |

#### Inventory Linkage *(conditional — when `line_type=item` affects stock)*

| Field | Type | Notes |
|---|---|---|
| `item_id` | ULID | — |
| `inventory_effect` | enum | `none`, `increase`, `decrease`, `reserved` |
| `move_ids` | `Y.Array` | Inventory move IDs (populated when movement created/linked) |
| `location_id` | ULID (opt) | Omit if single-location assumption |

#### Recommended

| Field | Notes |
|---|---|
| `cost_basis` | For COGS lens; may be derived |
| `project_id` / `job_id` | — |
| `gl_hint` | Helps mapping to accounts; not authoritative |

---

### 4.3 Double-Entry Postings (Ledger Lines)

**Fragment:** `tx:{tx_id}:postings` (`Y.Array` of `posting_id`)  
**Fragment:** `posting:{posting_id}` (`Y.Map`)

#### Required

| Field | Type | Notes |
|---|---|---|
| `posting_id` | ULID | — |
| `tx_id` | ULID | — |
| `account_id` | ULID | — |
| `direction` | enum | `debit`, `credit` |
| `amount` | decimal | In tx currency |
| `currency` | string | ISO 4217 |
| `effective_at_ms` | int64 | — |
| `party_id` | ULID (opt) | Recommended for AR/AP tracking |
| `line_ref` | ULID (opt) | `tx_line_id` if posting originates from a business line |
| `posting_group` | enum | `ar`, `ap`, `revenue`, `expense`, `cogs`, `inventory_asset`, `tax_payable`, etc. |

#### Recommended

| Field | Notes |
|---|---|
| `fx_rate` + `amount_base` | For multi-currency (Phase B) |
| `cost_center_id` / `dept_id` | — |
| `notes` | — |

> **Ledger invariant (hard):** For any `tx_id` with `status=posted`:  
> `sum(debits) == sum(credits)` (within rounding tolerance).  
> No postings may be edited after posting; reversals create a **new** tx.

---

### 4.4 Inventory Movement Atoms

**Fragment:** `invmove:{move_id}` (`Y.Map`)

#### Required

| Field | Type | Notes |
|---|---|---|
| `move_id` | ULID | — |
| `tx_id` | ULID | Origin |
| `tx_line_id` | ULID | Origin line |
| `item_id` | ULID | — |
| `location_id` | ULID | — |
| `qty_delta` | decimal | Positive = receipt; negative = issue |
| `uom` | string | — |
| `effective_at_ms` | int64 | — |
| `valuation_method` | enum | `fifo`, `weighted_avg`, `specific_id` *(Phase B depth)* |
| `unit_cost` | decimal | May be derived on receipt |
| `value_delta` | decimal | `qty_delta × unit_cost` (signed) |

#### Recommended

| Field | Notes |
|---|---|
| `lot_id` / `serial_id` | Phase B |
| `bin_id` | Warehouse sub-location |
| `reason_code` | `adjustment`, `damage`, `stocktake` |
| `counterparty` | Vendor/customer if relevant |

> **Inventory invariant:** Sum of linked inv moves must match the business line qty effect (unless partial shipments/receipts are explicitly modelled).

---

### 4.5 Approvals (Signature Layer)

**Fragment:** `approval:{approval_id}` (`Y.Map`)

#### Required

| Field | Type | Notes |
|---|---|---|
| `approval_id` | ULID | — |
| `tx_id` | ULID | — |
| `approval_type` | enum | `approve`, `post`, `pay`, `reverse`, `void` |
| `required_policy_id` | ULID | Link to policy fragment |
| `actor_pubkey` | Ed25519 | — |
| `signed_at_ms` | int64 | — |
| `signature_ref` | string | Reference to mutation/audit entry containing the signature |
| `result` | enum | `approved`, `rejected` |

#### Recommended

| Field | Notes |
|---|---|
| `comment` | — |
| `threshold_snapshot` | Amount thresholds used at time of approval |

---

### 4.6 Chart of Accounts & Parties (Minimum Schema)

**Fragment:** `account:{account_id}` (`Y.Map`)

| Field | Type | Notes |
|---|---|---|
| `account_id` | ULID | — |
| `name` | string | — |
| `type` | enum | `asset`, `liability`, `equity`, `income`, `expense` |
| `normal_balance` | enum | `debit`, `credit` |
| `status` | enum | `active`, `inactive` |

**Fragment:** `party:{party_id}` (`Y.Map`)

| Field | Type | Notes |
|---|---|---|
| `party_id` | ULID | — |
| `party_type` | enum | `customer`, `vendor`, `employee` |
| `display_name` | string | — |
| `keys` | `Y.Array` (opt) | Actor pubkeys linked to this party identity |

---

## 5. Posting Rules

### 5.1 Authoritative Posting Generation

> **Rule:** Postings are generated/validated in the **Rust engine**, not ad-hoc in the UI.

| Mode | Description |
|---|---|
| **Auto-post** | Simple templates for common tx types |
| **Guided-post** | Proposal + approval for complex/regulated flows |
| **Manual journal** | Accountant lens; always requires stricter permissions |

### 5.2 Example: Outgoing Invoice (`invoice_out`)

```
Business lines: item/service lines + tax lines

Postings:
  Debit   Accounts Receivable    (total gross)
  Credit  Revenue                (net)
  Credit  Tax Payable            (tax)

If shipped + COGS recognized:
  Debit   COGS
  Credit  Inventory Asset
  (invmove atom linked to tx_line; valuation derives unit_cost)
```

### 5.3 Example: Stock Receipt (`stock_receipt`)

```
Business line: item qty receipt
Inventory move: +qty_delta into location; value_delta at unit_cost

Postings:
  Debit   Inventory Asset       (value)
  Credit  Accounts Payable
          or GRNI               (config)
```

### 5.4 Reversal

No edits to posted tx. Reversal is a **new tx**:
- `tx_type=journal` or `credit_note`/`debit_note`
- Postings mirror original with opposite directions
- Links back to original via `refs.reverses_tx_id`

---

## 6. Status Model & State Transitions

```
draft → proposed (AI/plugin may propose; human may propose)
proposed → approved (requires approval atom(s) per policy)
approved → posted (requires "post" approval/signature)
posted → reversed (requires reverse approval; creates new tx)
draft/proposed → void (policy-gated)
```

> **Invariant:** Posted transactions are **immutable**. Only reversal is allowed.

---

## 7. Inventory ↔ Ledger Linkage ("No Sync Drift" Contract)

> If a TxAtom line changes inventory, it **MUST** link to inventory movement atoms, and the ledger postings **MUST** reflect the value impact according to configured valuation policy.

### 7.1 Required Linkage

- `txline.move_ids[]` references `invmove` atoms
- `invmove.tx_id` and `invmove.tx_line_id` reference back
- If COGS is recognised, postings reference `tx_line_id` or `invmove.move_id` as provenance

### 7.2 Partial Receipts / Shipments

Model as:
- Multiple `invmove` atoms linked to a single `tx_line_id` over time
- Line = the **intent**; moves = the **actuals**
- Cockpit/AR lens shows "partially fulfilled" state derived from move sums

---

## 8. Required Indexes (Lens Performance)

| Index | Purpose |
|---|---|
| `tx_by_time` | Chronological ledger view |
| `tx_by_type:{type}` | Invoice lists, bill lists |
| `tx_by_party:{party}` | AR/AP by customer/vendor |
| `postings_by_account:{account}` | Account balance lens |
| `inventory_moves_by_item:{item}` | Stock on hand lens |
| `approvals_by_tx:{tx}` | Approval status per tx |

> **Phase B:** Add checkpoints + materialized rollups (balances by account, stock on hand by item/location).

---

## 9. Rounding, Precision & Tolerance

- Store monetary decimals with fixed precision (2–4 dp depending on currency; engine standardises)
- Define `rounding_tolerance` (e.g., `0.01`) for balance checks
- Balance invariant uses tolerance; any failure **blocks** `posted`

---

## 10. Minimal Policy Defaults (Phase A)

### 10.1 Who Can Do What

| Role | Draft Tx | Create Moves | Post Financial Tx | Reverse |
|---|---|---|---|---|
| Staff | ✅ | ✅ | ❌ | ❌ |
| Manager | ✅ | ✅ | ⚠️ threshold | ❌/⚠️ |
| Finance | ✅ | ✅ | ✅ | ✅ |
| Auditor | Read-only | Read-only | ❌ | ❌ |

### 10.2 Posting Gates

- Any creation of `posting:*` requires ABAC check
- Transition to `posted` requires an `approval` atom of type `post` with valid `signature_ref`

---

## 11. Example TxAtom Walkthroughs

### 11.1 Outgoing Invoice with Shipped Item

**Fragments created:**

| Fragment | Content |
|---|---|
| `tx:{id}:hdr` | `invoice_out`, status=`proposed` |
| `tx:{id}:lines` + `txline:{line1}` | item, qty 5, `inventory_effect=decrease` |
| `tx:{id}:postings` | Draft postings (AR, revenue, tax) as proposal |
| `invmove:{m1}` | `qty_delta=-5` linked to `tx_line_id` |
| `approval:{a1}` | type=`approve` |
| `approval:{a2}` | type=`post` |

**On post:**
- `status` → `posted`
- Postings finalised and immutable
- If COGS: additional postings (COGS debit, Inventory credit) linked to invmove

### 11.2 Stock Receipt Before Vendor Invoice (GRNI)

```
Step 1 — Stock Receipt:
  tx_type=stock_receipt
  invmove: qty +10, value +$500
  Postings:
    Debit  Inventory Asset   $500
    Credit GRNI              $500

Step 2 — Vendor Bill clears GRNI:
  tx_type=invoice_in
  Postings:
    Debit  GRNI              $500
    Credit Accounts Payable  $500 (+ tax/expenses as relevant)
```

---

## 12. Definition of Done (Schema Spec — Engineering)

This spec is "implemented" when:

- [ ] Rust engine can **generate and validate postings** for: `invoice_out`, `stock_receipt`, `payment_in/out`, `journal`, `stock_adjust`
- [ ] `posted` **balance invariant** enforced with tolerance
- [ ] Inventory moves **link to tx lines**; partial fulfillment supported via multiple moves
- [ ] Lenses can query indexes to render:
  - Ledger grid (by time/type/party)
  - Account balance lens *(Phase A: computed on the fly)*
  - Stock on hand lens *(Phase A: computed on the fly)*
- [ ] **Drill-to-source** traverses: `posting → tx → tx_line → invmove → approval → mutation envelope/audit entry`

---

## 13. Phase B Extensions *(Hooks — not required in Phase A)*

- Multi-currency (base currency + FX postings)
- Lots / serials / bins
- Weighted average / FIFO engines with checkpointed valuation layers
- Payroll atoms
- Deeper regulatory templates (medical/defense) as Lens packs

---

*See also: [PRD.md](./PRD.md) · [TECHNICAL_BLUEPRINT.md](./TECHNICAL_BLUEPRINT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SKILLS.md](./SKILLS.md)*

**Last Updated:** 27 February 2026  
**Version:** Schema Spec v1 (Phase A Baseline)
