# Corngr-ERP — Rust Engine API Contracts v1

> **Codename:** Antigravity  
> **Scope:** Phase A baseline (Schema-to-Bridge aligned)

## Principles

| Principle | Value |
|---|---|
| `local_first` | true |
| `signed_reality` | true |
| `engine_is_gatekeeper` | true |
| `plugins_propose_only_by_default` | true |

---

## Conventions

| Convention | Format |
|---|---|
| IDs | ULID strings |
| Time | `int64` epoch milliseconds |
| Money | String decimal (engine validates precision/tolerance) |
| Mutations | Engine returns a signed mutation envelope + resulting head hash |
| Status values | `draft` · `proposed` · `approved` · `posted` · `reversed` · `void` |
| Tx types | `invoice_out` · `invoice_in` · `payment_in` · `payment_out` · `stock_receipt` · `stock_issue` · `stock_adjust` · `journal` · `credit_note` · `debit_note` |
| Modes | `direct` · `proposal_only` |
| Roles | `owner_admin` · `manager` · `finance` · `staff` · `auditor` |

---

## Error Model

### Error Shape

```json
{
  "error": {
    "code": "ERR_*",
    "message": "human readable",
    "details": {},
    "retryable": false,
    "trace_id": "string"
  }
}
```

### Error Codes

| Category | Codes |
|---|---|
| **Authorization** | `ERR_ABAC_DENY` · `ERR_CAPABILITY_MISSING` · `ERR_CAPABILITY_EXPIRED` · `ERR_SCOPE_VIOLATION` |
| **Signature / Integrity** | `ERR_SIG_INVALID` · `ERR_CONTENT_HASH_MISMATCH` · `ERR_REPLAY_MUTATION_ID` · `ERR_LAMPORT_REWIND` |
| **Not Found / Exists** | `ERR_NOT_FOUND` · `ERR_ALREADY_EXISTS` |
| **Validation** | `ERR_INVALID_STATUS` · `ERR_INVALID_TX_TYPE` · `ERR_INVALID_FIELD` · `ERR_VALIDATION_FAIL` |
| **Ledger** | `ERR_BALANCE_FAIL` · `ERR_ROUNDING_TOLERANCE_EXCEEDED` · `ERR_POSTINGS_MISSING` · `ERR_POSTINGS_IMMUTABLE` |
| **Immutability** | `ERR_LINE_IMMUTABLE` · `ERR_MOVE_IMMUTABLE` |
| **Inventory** | `ERR_MOVE_QTY_EXCEEDS` · `ERR_ITEM_MISMATCH` · `ERR_INVENTORY_EFFECT_MISMATCH` |
| **Approvals** | `ERR_APPROVAL_MISSING` · `ERR_APPROVAL_INVALID` · `ERR_APPROVAL_NOT_AUTHORIZED` · `ERR_POLICY_CHANGED` |
| **System** | `ERR_INDEX_UPDATE_DENIED` · `ERR_OUTBOX_CONFLICT` · `ERR_ANCHOR_CONFLICT` · `ERR_PRIMARY_UNREACHABLE` · `ERR_PARTIAL_ACCEPT` · `ERR_INTERNAL` |

---

## Common Types

### `ActorContext`

```typescript
{
  actor_pubkey:        string;
  device_pubkey:       string | null;
  role_hint:           string | null;
  network_zone:        string | null;
  device_trust:        string | null;
  capability_token_id: string | null;
  mode:                "direct" | "proposal_only";
}
```

### `EngineResult.ok`

```typescript
{
  mutation_id:        string;
  new_head_hash:      string;
  affected_fragments: string[];
  envelope: {
    envelope_version:    "1";
    org_id:              string;
    mutation_id:         string;
    actor_pubkey:        string;
    device_pubkey:       string | null;
    issued_at_ms:        number;
    lamport:             number;
    prev_hash:           string;
    capability_token_id: string | null;
    ops:                 object[];
    policy_context:      object;
    content_hash:        string;
    signature:           string;
    attachments:         object[];
  };
  warnings: Array<{ code: string; message: string; details: object }>;
}
```

### `TxRef`

```typescript
{
  tx_id:               string;
  hdr_fragment_id:     string;
  lines_fragment_id:   string;
  postings_fragment_id: string;
}
```

---

## Endpoints

---

### `POST /v1/tx/create` — `create_tx`

*Create tx header, initialize lines/postings arrays, write engine indexes.*

**ABAC:** `tx.create` on domain `tx`

#### Request

```typescript
{
  org_id:          string;
  tx_id:           string | null;   // engine generates ULID if omitted
  tx_type:         string;
  effective_at_ms: number;
  currency:        string;
  parties: {
    customer_id: string | null;
    vendor_id:   string | null;
    employee_id: string | null;
  };
  memo: string | null;
  refs: {
    external_ref:   string | null;
    invoice_number: string | null;
    po_number:      string | null;
    shipment_ref:   string | null;
  };
  tags:  string[];
  actor: ActorContext;
}
```

#### Response

```typescript
{ tx: TxRef; status: "draft"; result: EngineResult.ok }
```

#### Errors
`ERR_ABAC_DENY` · `ERR_INVALID_TX_TYPE` · `ERR_INVALID_FIELD` · `ERR_ALREADY_EXISTS` · `ERR_INTERNAL`

> Engine initializes empty `tx:{id}:lines` and `tx:{id}:postings` arrays and writes `tx_by_time`, `tx_by_type`, and optional `tx_by_party` indexes.

---

### `POST /v1/tx/header/edit` — `edit_tx_header`

*Edit header fields while tx is `draft` or `proposed`.*

**ABAC:** `tx.edit` — `status ∈ {draft, proposed}`

#### Request

```typescript
{
  org_id: string;
  tx_id:  string;
  patch: {
    memo:            string | null;
    effective_at_ms: number | null;
    currency:        string | null;
    parties:         { customer_id?; vendor_id?; employee_id? };
    refs:            object;
    tags:            string[];
  };
  actor: ActorContext;
}
```

#### Response

```typescript
{ tx_id: string; result: EngineResult.ok }
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_INVALID_FIELD` · `ERR_INTERNAL`

---

### `POST /v1/tx/status/transition` — `transition_tx_status`

*Transition status (`draft→proposed`, `proposed→approved`, or `→void`). Use `post_tx` for `approved→posted`.*

**ABAC:** `tx.status.transition` — conditions per policy

#### Request

```typescript
{
  org_id:    string;
  tx_id:     string;
  to_status: "draft" | "proposed" | "approved" | "void";
  reason:    string | null;
  actor:     ActorContext;
}
```

#### Response

```typescript
{ tx_id: string; new_status: string; result: EngineResult.ok }
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_APPROVAL_MISSING` · `ERR_APPROVAL_INVALID` · `ERR_POLICY_CHANGED` · `ERR_INTERNAL`

> `proposed→approved` requires approval atom to exist (or caller calls `sign_approval` first). `approved→posted` is handled exclusively by `post_tx`.

---

### `POST /v1/tx/line/add` — `add_line`

*Create tx line fragment and link into `tx:{id}:lines`.*

**ABAC:** `txline.create` — `tx_status ∈ {draft, proposed}`

#### Request

```typescript
{
  org_id:           string;
  tx_id:            string;
  tx_line_id:       string | null;
  line_type:        "item" | "service" | "tax" | "discount" | "shipping" | "fee" | "note";
  description:      string;
  qty:              string;
  uom:              string;
  unit_price:       string;
  tax_code:         string | null;
  item_id:          string | null;
  inventory_effect: "none" | "increase" | "decrease" | "reserved";
  location_id:      string | null;
  project_id:       string | null;
  job_id:           string | null;
  actor:            ActorContext;
}
```

#### Response

```typescript
{
  tx_id:      string;
  tx_line_id: string;
  computed: { net_amount: string; tax_amount: string; gross_amount: string };
  result:   EngineResult.ok;
}
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_INVALID_FIELD` · `ERR_VALIDATION_FAIL` · `ERR_INTERNAL`

> Engine computes `net`/`tax`/`gross` canonically. If `inventory_effect != none`, `item_id` is required; engine initializes `move_ids` as empty array.

---

### `POST /v1/tx/line/edit` — `edit_line`

*Patch tx line fields while draft/proposed. Inventory invariants enforced.*

**ABAC:** `txline.edit` — `tx_status ∈ {draft, proposed}`

#### Request

```typescript
{
  org_id:      string;
  tx_id:       string;
  tx_line_id:  string;
  patch: {
    description:      string | null;
    qty:              string | null;
    uom:              string | null;
    unit_price:       string | null;
    tax_code:         string | null;
    item_id:          string | null;
    inventory_effect: "none" | "increase" | "decrease" | "reserved" | null;
    location_id:      string | null;
  };
  actor: ActorContext;
}
```

#### Response

```typescript
{
  tx_id: string; tx_line_id: string;
  computed: { net_amount: string; tax_amount: string; gross_amount: string };
  result: EngineResult.ok;
}
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_LINE_IMMUTABLE` · `ERR_MOVE_QTY_EXCEEDS` · `ERR_ITEM_MISMATCH` · `ERR_VALIDATION_FAIL` · `ERR_INTERNAL`

> If moves exist, engine prevents qty reductions below moved qty (`ERR_MOVE_QTY_EXCEEDS`). Changing `item_id` once moves exist raises `ERR_ITEM_MISMATCH`.

---

### `POST /v1/tx/line/delete` — `delete_line`

*Tombstone a line and unlink from tx lines array.*

**ABAC:** `txline.delete` — `tx_status ∈ {draft, proposed}`, no finalized moves/postings on line

#### Request

```typescript
{ org_id: string; tx_id: string; tx_line_id: string; actor: ActorContext; }
```

#### Response

```typescript
{ tx_id: string; tx_line_id: string; result: EngineResult.ok }
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_LINE_IMMUTABLE` · `ERR_MOVE_IMMUTABLE` · `ERR_INTERNAL`

---

### `POST /v1/inventory/move/create` — `create_invmove`

*Create inventory movement atom and link into `txline.move_ids`. Update item index.*

**ABAC:** `invmove.create` — `tx_status != posted`, `txline.line_type = item`

#### Request

```typescript
{
  org_id:            string;
  move_id:           string | null;
  tx_id:             string;
  tx_line_id:        string;
  item_id:           string;
  location_id:       string;
  qty_delta:         string;
  uom:               string;
  effective_at_ms:   number;
  unit_cost:         string | null;
  valuation_method:  "fifo" | "weighted_avg" | "specific_id";
  reason_code:       string | null;
  actor:             ActorContext;
}
```

#### Response

```typescript
{
  move_id: string;
  linked:  { tx_id: string; tx_line_id: string };
  computed: { unit_cost: string | null; value_delta: string | null };
  result:  EngineResult.ok;
}
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_ITEM_MISMATCH` · `ERR_INVENTORY_EFFECT_MISMATCH` · `ERR_MOVE_QTY_EXCEEDS` · `ERR_INVALID_FIELD` · `ERR_INTERNAL`

> Engine verifies `item_id` matches `txline.item_id` and `qty_delta` sign matches `inventory_effect`. Updates `inventory_moves_by_item` index (engine-only).

---

### `POST /v1/ledger/postings/generate` — `generate_postings`

*Generate (or regenerate) draft postings from tx lines using posting templates. Does not post.*

**ABAC:** `posting.create` — `tx_status ∈ {draft, proposed, approved}`, role `finance` or `manager < threshold`

#### Request

```typescript
{
  org_id:  string;
  tx_id:   string;
  regen:   boolean;   // if true, tombstones prior draft postings first
  mode:    "draft" | "proposal";
  actor:   ActorContext;
}
```

#### Response

```typescript
{
  tx_id:    string;
  postings: Array<{
    posting_id: string; account_id: string; direction: "debit" | "credit";
    amount: string; posting_group: string; status: "draft";
  }>;
  balance_check: { debits: string; credits: string; balanced: boolean; tolerance: string };
  result: EngineResult.ok;
}
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_VALIDATION_FAIL` · `ERR_INTERNAL`

> `mode=proposal` creates a `Proposal` with suggested posting ops instead of writing postings directly — use for AI/plugin flows. If `regen=true`, engine tombstones prior draft postings then creates new ones.

---

### `POST /v1/tx/approval/sign` — `sign_approval`

*Create approval atom (`approve`/`post`/`reverse`/`void`/`pay`) referencing signature in audit chain.*

**ABAC:** `approval.sign` — type and threshold checked by role/policy

#### Request

```typescript
{
  org_id:             string;
  tx_id:              string;
  approval_id:        string | null;
  approval_type:      "approve" | "post" | "reverse" | "void" | "pay";
  required_policy_id: string;
  comment:            string | null;
  actor:              ActorContext;
}
```

#### Response

```typescript
{ tx_id: string; approval_id: string; approval_type: string; result: EngineResult.ok }
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_APPROVAL_NOT_AUTHORIZED` · `ERR_POLICY_CHANGED` · `ERR_INTERNAL`

> Approval atom includes `signature_ref` linking to the audit entry for this mutation. For `approve`/`post`, engine checks gross amounts against role thresholds.

---

### `POST /v1/tx/post` — `post_tx`

*Perform the "post ceremony": verify approvals → finalize invmoves → finalize postings → transition to `posted`.*

**ABAC:** `tx.status.transition` — `tx_status = approved`, post approval exists, role `finance` or `manager < threshold`

#### Request

```typescript
{
  org_id:                          string;
  tx_id:                           string;
  auto_generate_postings_if_missing: boolean;
  auto_finalize_invmoves:          boolean;
  actor:                           ActorContext;
}
```

#### Response

```typescript
{
  tx_id:      string;
  new_status: "posted";
  finalized: { postings_finalized: number; invmoves_finalized: number };
  balance_check: { debits: string; credits: string; balanced: boolean; tolerance: string };
  result: EngineResult.ok;
}
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_APPROVAL_MISSING` · `ERR_APPROVAL_INVALID` · `ERR_POSTINGS_MISSING` · `ERR_BALANCE_FAIL` · `ERR_ROUNDING_TOLERANCE_EXCEEDED` · `ERR_MOVE_QTY_EXCEEDS` · `ERR_VALIDATION_FAIL` · `ERR_INTERNAL`

> Engine applies ops in the canonical "post ceremony" sequence: approvals → invmove finalization → posting finalization → status=posted. If `auto_generate_postings_if_missing=true`, engine generates postings internally (engine-derived) before finalizing.

---

### `POST /v1/tx/reverse` — `reverse_tx`

*Create and post a reversal transaction referencing an original posted tx.*

**ABAC:** `tx.reverse` — `original.status = posted`, role `finance`, reverse approval exists

#### Request

```typescript
{
  org_id:           string;
  original_tx_id:   string;
  reversal_tx_id:   string | null;
  effective_at_ms:  number | null;
  comment:          string | null;
  actor:            ActorContext;
}
```

#### Response

```typescript
{ original_tx_id: string; reversal_tx_id: string; result: EngineResult.ok }
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INVALID_STATUS` · `ERR_APPROVAL_MISSING` · `ERR_APPROVAL_NOT_AUTHORIZED` · `ERR_INTERNAL`

> Engine creates reversal tx header with mirror postings (opposite direction) and posts it. Optionally marks original tx `status=reversed` without mutating its postings.

---

### `POST /v1/tx/snapshot` — `get_tx_snapshot`

*Return a structured view of tx hdr/lines/postings/invmoves/approvals for UI and audit drill-down. Read-only.*

**ABAC:** `tx.read` on domain `tx`

#### Request

```typescript
{
  org_id:             string;
  tx_id:              string;
  include_audit_refs: boolean;
  actor:              ActorContext;
}
```

#### Response

```typescript
{
  tx_id:    string;
  hdr:      object;
  lines:    object[];
  postings: object[];
  invmoves: object[];
  approvals: object[];
  audit: { head_hash: string; entry_refs: string[] };
}
```

#### Errors
`ERR_NOT_FOUND` · `ERR_ABAC_DENY` · `ERR_INTERNAL`

---

## Endpoint Summary

| Endpoint | Path | Purpose |
|---|---|---|
| `create_tx` | `POST /v1/tx/create` | Create tx header + init arrays + index |
| `edit_tx_header` | `POST /v1/tx/header/edit` | Edit header fields (draft/proposed) |
| `transition_tx_status` | `POST /v1/tx/status/transition` | Status transitions (excl. post) |
| `add_line` | `POST /v1/tx/line/add` | Add business line to tx |
| `edit_line` | `POST /v1/tx/line/edit` | Edit line fields (draft/proposed) |
| `delete_line` | `POST /v1/tx/line/delete` | Tombstone line |
| `create_invmove` | `POST /v1/inventory/move/create` | Create inv movement + link to line |
| `generate_postings` | `POST /v1/ledger/postings/generate` | Generate draft postings from lines |
| `sign_approval` | `POST /v1/tx/approval/sign` | Create signed approval atom |
| `post_tx` | `POST /v1/tx/post` | Full post ceremony |
| `reverse_tx` | `POST /v1/tx/reverse` | Create + post reversal tx |
| `get_tx_snapshot` | `POST /v1/tx/snapshot` | Read-only tx view for UI/audit |

---

*See also: [SCHEMA_BRIDGE_MAPPING.md](./SCHEMA_BRIDGE_MAPPING.md) · [SCHEMA_SPEC.md](./SCHEMA_SPEC.md) · [TECHNICAL_BLUEPRINT.md](./TECHNICAL_BLUEPRINT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)*

**Last Updated:** 27 February 2026  
**Version:** API Contracts v1 (Phase A Baseline)
