# Phase 4 — Historical payment JE repair execution

## Scope

- **No deletes.** Only `UPDATE journal_entries` plus rows in `je_payment_linkage_repair_audit`.
- **Artifacts:** `migrations/20260340_historical_payment_je_linkage_repair.sql` (audit table), `migrations/20260341_phase4_payment_je_linkage_repair_apply.sql` (optional auto **P3 → P6**), `scripts/sql/phase3_payment_je_linkage_playbook.sql` (detection, dry-run, manual APPLY, rollback).

---

## PHASE 4 — Execution checklist (Supabase SQL)

### STEP 0 — Safety

```sql
SELECT current_database();
```

- Confirm project / database. Scope playbook filters to one `company_id` on production if needed.
- **Optional:** take a backup (Supabase Dashboard → Database → Backups) before first apply on production.

### STEP 1 — Ensure audit table (run once)

Run migration file:

- `migrations/20260340_historical_payment_je_linkage_repair.sql`

**Expect:** `public.je_payment_linkage_repair_audit` exists (`repair_batch_id` is **UUID** — use `gen_random_uuid()` for batches, not string labels unless you cast).

### STEP 2 — Detection (no changes)

From `scripts/sql/phase3_payment_je_linkage_playbook.sql`, run **PART 1** only.

| Section | What it measures |
|--------|-------------------|
| **1A** | Payment-type JEs missing `payment_id` / `reference_id` symmetry |
| **1B** | `sale` / `purchase` JEs with `payment_id` but `reference_id` null |
| **1C** | Orphan payments (no active non-void JE on `payment_id`) |
| **1D** | Walk-in–related linkage gaps |
| **1E** | Weak payment JEs where company has default walking customer |

Record counts (e.g. in `docs/accounting/PHASE4_REPAIR_COUNTS_TEMPLATE.json` under `before`).

### STEP 3 — Dry-run buckets

From the same playbook, run **PART 2** (P3–P5 previews), **PART 2B** (P6 heuristic preview), and **PART 2C** (grouped bucket counts).

Save counts into `PHASE4_REPAIR_COUNTS_TEMPLATE.json` (or a copy) under dry-run / preview.

### STEP 4 — Apply repairs (order matters)

**P3** → **P4** → **P5** → **P6** (same semantics as playbook).

| Wave | Rule (short) |
|------|----------------|
| **P3** | `payment_id` set, `reference_id` null → set `reference_id = payment_id` |
| **P4** | `reference_id` is a valid `payments.id`, `payment_id` null → set `payment_id = reference_id` (no conflict) |
| **P5** | `sale` / `purchase` JEs with `payment_id` but null `reference_id` → set `reference_id` from `payments.reference_id` |
| **P6** | Both null → heuristic **unique** match only (playbook rules) |

**Option A — Auto-apply (recommended on deploy):** after STEP 1, run migration `migrations/20260341_phase4_payment_je_linkage_repair_apply.sql`. One transaction runs P3→P6, inserts audit rows, and **`RAISE NOTICE`** prints four batch UUIDs (check Supabase SQL / migration logs). Re-run is idempotent.

**Option B — Manual:** uncomment **PART 3 → PART 6** in the playbook **one part at a time**. For each wave, set a **new** `repair_batch_id` = `gen_random_uuid()` (column is UUID; avoid `'P3_' || gen_random_uuid()` unless you explicitly cast to `uuid`).

### STEP 5 — Verify repairs

Re-run **PART 1** (1A–1E).

**Expect:** counts **↓**, especially **1A**, **1B**, **1E** (1C may remain if payments truly have no JE).

### STEP 6 — Check audit log

```sql
SELECT *
FROM public.je_payment_linkage_repair_audit
ORDER BY created_at DESC
LIMIT 50;
```

**Expect:** rows for each applied wave; `repair_batch_id` present (four UUIDs if you used **20260341**, or one per manual wave).

### STEP 7 — Rollback (if needed)

Playbook **PART 7**: restore from `je_payment_linkage_repair_audit` filtered by `repair_batch_id`.

### After SQL — app validation

Spot-check:

- Walk-in customer flows  
- Contacts list  
- Operational tab / GL tab  
- Reconciliation  
- Integrity Lab  
- Party tie-out  

**Done criteria**

- Payment JEs linked to payments where repair applied  
- Tie-out / Integrity Lab noise reduced for repaired rows  
- Fewer `PAYMENT_WITHOUT_JE` / “No display reference found” where linkage was the root cause  

---

## Prerequisites (roles)

- Role can `UPDATE journal_entries` and `INSERT` into `je_payment_linkage_repair_audit` (typically SQL editor as postgres / service role for migrations).

## Detailed manual runbook

### Company scope (optional)

In playbook queries, uncomment and set:

`-- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid`

(or equivalent for `p.company_id` / `c.company_id`) for single-tenant production runs.

### Manual apply — per-part verification

After each playbook PART 3–6 block:

```sql
SELECT repair_batch_id, bucket, COUNT(*)
FROM public.je_payment_linkage_repair_audit
WHERE repair_batch_id = '…'::uuid
GROUP BY 1, 2;
```

Re-run **PART 2C**; P3–P6 bucket counts should drop for applied waves.

## Validation — JE-0135 / PAY-0084 style rows

These are **patterns**, not global IDs:

1. **JE-0135 class:** `journal_entries` with `reference_type` in (`payment`, `payment_adjustment`) and (`payment_id` IS NULL OR `reference_id` IS NULL). After P3/P4/P6, re-query **1A** detail list; the row should either disappear or show both IDs populated (if a matching payment existed).
2. **PAY-0084 class:** `payments` row with **no** active non-void `journal_entries.payment_id` pointing to it (**1C** / **1D**). After repair, if a JE was linked (P6), **1C** for that payment should clear; if the payment never had a JE, you still need a **posting** path or manual JE — SQL linkage cannot invent a journal.

## Walk-in customer — old on-account

1. Run **1D** — lists walk-in-associated payments without an active linked JE.
2. Run **1E** — weak payment JEs in companies with default walking customer.
3. After **P3 → P5**, re-run **1A** for that `company_id`.
4. After **P6**, re-run **1D**; orphan payments that had a uniquely matchable JE should reduce.

## Before vs after checklist

| Check | Query | Expect after successful repair |
|-------|--------|--------------------------------|
| 1A | Playbook PART 1 | Lower or zero weak `payment` JEs |
| 1B | PART 1 | Lower or zero missing doc ref on sale/purchase payment JEs |
| 1C | PART 1 | May remain if payments truly have no JE |
| 1D | PART 1 | Lower when P6 linked orphan JEs to walk-in payments |
| 1E | PART 1 | Lower when symmetry + heuristic fixed linkage |
| Party tie-out | App | Fewer `PAYMENT_WITHOUT_JE` where JE now has `payment_id` |
| Integrity Lab | App | Fewer payment-link anomalies for repaired rows |

## Execution result (fill when run)

| Item | Status |
|------|--------|
| Migration 20260340 applied | ☐ |
| Detection recorded (1A–1E) | ☐ |
| Dry-run (PART 2 / 2B / 2C) saved | ☐ |
| Repairs: **20260341** *or* manual P3–P6 | ☐ |
| P3 batch UUID | |
| P4 batch UUID | |
| P5 batch UUID | |
| P6 batch UUID | |
| Post validation 1A–1E | ☐ |
| Audit log reviewed | ☐ |
| Rollback tested (non-prod) | ☐ |

**Note:** Row counts and UUIDs belong in `PHASE4_REPAIR_COUNTS_TEMPLATE.json` (or a copy) after you execute on your tenant.
