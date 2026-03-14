# ERP Next Steps Implementation Plan

## Current status

Your ERP audits confirmed these facts:

- Canonical sale line table is `sales_items`
- Legacy fallback sale line table is `sale_items`
- Canonical accounting path is `accounts + journal_entries + journal_entry_lines`
- `chart_accounts` is legacy for posting
- `ledger_master` / `ledger_entries` are subsidiary ledgers, not duplicates
- Canonical numbering is `erp_document_sequences`
- `document_sequences` is a legacy fallback
- Canonical studio path is `studio_productions + studio_production_stages`
- Studio v2/v3 tables are optional/versioned, not removable right now
- Dashboard slowdown is mainly due to multiple queries / fallback queries instead of one consolidated RPC

---

## Safe execution order

### Step 0 — Backup first

#### Full backup
```bash
pg_dump -h localhost -U postgres -d postgres --format=custom --file=erp_backup_before_final_stabilization.dump
```

#### Schema backup
```bash
pg_dump -h localhost -U postgres -d postgres --schema-only --file=erp_schema_before_final_stabilization.sql
```

#### Git checkpoint
```bash
git add .
git commit -m "SAFE CHECKPOINT BEFORE ERP FINAL STABILIZATION"
git tag ERP_FINAL_STABILIZATION_SAFE_POINT
```

---

## Step 1 — Fix reporting service

### Goal
Make reporting consistent with `sales_items` as canonical.

### What to do
- Inspect `accountingReportsService`
- Replace direct `sale_items` only logic
- Use:
  - `sales_items` first
  - `sale_items` fallback

### Why
This removes mismatch between app writes and report reads.

### Output
- reporting code updated
- `docs/ERP_REPORTING_ALIGNMENT.md`

---

## Step 2 — Audit payments indexes safely

### Goal
Avoid wasting time on indexes that already exist while adding only missing ones.

### Important
If you get:
```sql
ERROR: 42P07: relation "idx_payments_reference" already exists
```
that means the index already exists. Do not recreate it.

### What to verify
Check `pg_indexes` for the `payments` table and confirm whether these exist:

- company_id
- company_id + payment_date
- company_id + created_at
- reference_type + reference_id

### Safe SQL to inspect
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'payments'
ORDER BY indexname;
```

### Only if missing, create indexes
Use `CREATE INDEX IF NOT EXISTS`.

### Output
- `docs/ERP_PAYMENTS_INDEX_AUDIT.md`
- optional migration only for missing indexes

---

## Step 3 — Implement dashboard RPC

### Goal
Reduce dashboard from many calls to 1 RPC (+ optional alerts call).

### Current problem
Dashboard currently may use:
- financial metrics RPC or fallback
- sales by category queries
- low stock query
- alerts query

This can become 5 to 13 calls.

### Fix
Implement:

```sql
get_dashboard_metrics(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
```

### RPC should return
- financial metrics
- sales_by_category
- low_stock_items
- optional alerts

### Frontend update
Change dashboard code to use the new RPC.

### Output
- RPC migration
- dashboard service/frontend update
- `docs/ERP_DASHBOARD_RPC_IMPLEMENTATION.md`

---

## Step 4 — Document legacy structures

### Goal
Reduce confusion for future work and future AI prompts.

### Mark/document these as legacy
- `sale_items`
- `chart_accounts`
- `document_sequences`

### Keep these active
- `ledger_master`
- `ledger_entries`
- `worker_ledger_entries`
- `studio_production_orders_v2`
- `studio_production_orders_v3`
- related v2/v3 studio tables

### Output
- `docs/ERP_LEGACY_STRUCTURE_NOTES.md`
- optional safe comments migration

---

## Step 5 — Recheck accounting guardrails

### Goal
Ensure all posting still goes through canonical accounting tables.

### Re-verify these flows
- sales
- purchases
- payments
- expenses
- refunds / returns
- shipment
- stock adjustments
- manual entries
- studio accounting flows

### Confirm
- no new posting to `chart_accounts`
- reports still use canonical accounting structures

### Output
- `docs/ERP_ACCOUNTING_GUARDRAIL_CHECK.md`

---

## Step 6 — Final stabilization report

Create:

- `docs/ERP_FINAL_STABILIZATION_REPORT.md`

It should include:
- what changed
- what was verified
- what remains intentionally untouched
- performance improvement summary
- migrations created
- rollback notes

---

## Recommended practical priority

Do work in this exact order:

1. Reporting alignment
2. Payments index audit
3. Dashboard RPC
4. Legacy notes
5. Accounting guardrail check
6. Final stabilization report

---

## What not to do right now

Do **not** do these in this phase:

- do not drop `sale_items`
- do not drop `chart_accounts`
- do not drop studio v2/v3 tables
- do not rename tables
- do not perform destructive cleanup
- do not rewrite accounting architecture

---

## Expected result after this phase

After final stabilization, your ERP should have:

- aligned reporting path
- verified payments indexes
- faster dashboard loading
- documented legacy structures
- confirmed canonical accounting path
- safer future maintenance

---

## Useful restore commands

### Restore custom backup
```bash
pg_restore -U postgres -d postgres erp_backup_before_final_stabilization.dump
```

### Return to git checkpoint
```bash
git checkout ERP_FINAL_STABILIZATION_SAFE_POINT
```
