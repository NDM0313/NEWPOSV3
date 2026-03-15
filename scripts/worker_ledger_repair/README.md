# Worker Ledger Repair (Company-Scoped)

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

## Auto-apply (recommended)

From project root, with `.env.local` containing `DATABASE_URL` or `DATABASE_POOLER_URL` or `DATABASE_ADMIN_URL`:

```bash
npm run worker-ledger-repair
```

This runs `02_repair_backfill_company.sql` against your DB and prints any ambiguous rows.

## Duplicate cleanup (company-scoped)

If the same payment appears multiple times in Worker Ledger (e.g. PAY0069 / JE-8405 repeated):

**Auto-apply (recommended):**

```bash
npm run worker-ledger-dedupe
```

This runs detection (04) → cleanup (06) → verification (07). Uses `DATABASE_URL` / `DATABASE_POOLER_URL` / `DATABASE_ADMIN_URL` from `.env.local`.

**Manual (Supabase SQL Editor):**

1. **04_duplicate_detection_company.sql** – Read-only. Lists duplicate (worker_id, reference_id) groups.
2. **05_duplicate_preview_company.sql** – Read-only. Shows which row KEEP vs REMOVE per group.
3. **06_duplicate_cleanup_company.sql** – Deletes duplicate payment rows only (keeps earliest per group). Run after verifying 04/05.
4. **07_verification_company.sql** – Read-only. Confirms no remaining duplicates (should return 0 rows).

See `docs/ERP_WORKER_LEDGER_DUPLICATE_FIX_DELIVERABLE.md` for cause, design, and rollback.

## Manual run (Supabase SQL Editor)

Order for missing-ledger repair:

1. **01_diagnosis_company.sql** – Read-only. Latest journals, latest ledger, and journal rows missing in ledger (gap reason).
2. **02_repair_backfill_company.sql** – Backfill worker_ledger_entries; infer worker from description where unique; report ambiguous rows.
3. **03_reconciliation_company.sql** – Read-only. Journal vs ledger gaps, summary by worker/date, ambiguous rows.

No DELETEs in 01–03. Safe to run 02 multiple times (idempotent backfill). See `docs/ERP_WORKER_LEDGER_FIX_DELIVERABLE.md` for full status, strategy, and verification.
