# Phase B — unified PAY outgoing (smoke checklist)

**Migrations:**  
- `migrations/20260604120000_phase_b_unify_pay_outgoing_sequence.sql` (RPC + bulk merge at deploy)  
- `migrations/20260604130000_merge_pay_sequence_company_scoped_rpc.sql` (Settings merge button — one company, admin/owner only)  

Apply on Supabase/VPS before web smoke tests.**

## What changed (future records only)

| Path | Before | After |
|------|--------|-------|
| Purchase Add Payment | PAY (`payment`) | PAY (`payment`) — unchanged |
| Add Entry Supplier Payment | PAY (`supplier_payment` counter) | PAY (`payment`) via RPC |
| Add Entry Worker Payment | PAY (client `payment`) | PAY via RPC (`worker_payment` ref, `payment` sequence) |
| Add Entry Courier Payment | PAY (client insert + manual JE) | PAY via RPC (`courier_payment`) |
| Studio / worker dialog | WPY (`worker_payment`) | **PAY** (`payment` sequence) |
| Add Entry Expense Payment | EXP (`expense`) | **EXP** — unchanged (client path) |
| Historical rows | WPY / EXP / old PAY | **Unchanged** |

## Manual smoke (production or staging)

1. Note current max `PAY-*` in `payments` (paid) for your company.
2. **Purchase → Add Payment** → next ref = max+1 `PAY-`.
3. **Add Entry → Supplier Payment** (same branch) → next `PAY-` continues same counter.
4. **Add Entry → Worker Payment** → next `PAY-` (not `WPY-`).
5. **Add Entry → Courier Payment** → next `PAY-`.
6. **Add Entry → Expense Payment** → `EXP-` (not `PAY-`).
7. Confirm old `WPY-*` / `EXP-*` / existing `payments.reference_number` unchanged in DB.
8. Roznamcha: one row per payment; no duplicate JE+payment for RPC paths.

## SQL (read-only)

```sql
SELECT document_type, last_number, year
FROM erp_document_sequences
WHERE company_id = '<company_uuid>'
  AND document_type IN ('PAYMENT', 'SUPPLIER_PAYMENT', 'WORKER_PAYMENT')
  AND branch_id = (SELECT public.erp_numbering_global_branch_sentinel())
ORDER BY document_type;
```

```sql
SELECT reference_number, reference_type, created_at
FROM payments
WHERE company_id = '<company_uuid>' AND payment_type = 'paid'
ORDER BY created_at DESC
LIMIT 10;
```

## Settings → Numbering (admin/owner)

1. **Numbering Rules** — Row **Outgoing payment** shows PAY; description mentions purchase, supplier, worker, courier. **Expense** says EXP not PAY. **Customer receipt** says RCV. No editable `SUPPLIER_PAYMENT` / `WORKER_PAYMENT` rows.
2. **Numbering Maintenance** — Analyze: PAY row uses effective last = max(`PAYMENT`, `SUPPLIER_PAYMENT` counters). If `SUPPLIER_PAYMENT.last_number` > `PAYMENT`, status should not falsely show OK unless effective max is used.
3. **Sync PAY counter (merge legacy)** — Calls `merge_supplier_payment_sequence_for_company` (current company only; not all tenants). Re-analyze after merge.
4. Deprecated table shows `SUPPLIER_PAYMENT` / `WORKER_PAYMENT` with **Deprecated** badge — no Fix button.
5. **Number Audit Log** — Friendly type labels (e.g. Outgoing payment (PAY)).
6. Confirm no historical `payments.reference_number` or audit rows changed by Settings actions.

## Build

```bash
npm run build
```
