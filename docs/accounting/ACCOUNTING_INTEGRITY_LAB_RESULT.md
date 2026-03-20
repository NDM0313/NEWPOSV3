# Accounting Integrity Lab — RESULT (accounting folder copy)

The maintained lab deliverable is **[`../ACCOUNTING_INTEGRITY_LAB_RESULT.md`](../ACCOUNTING_INTEGRITY_LAB_RESULT.md)**.

## 2026-03-20 — Document certification vs company reconciliation

See parent doc **“Two-layer verification (document vs company)”**. Company-wide TB/BS/AR/AP no longer run automatically after action-runner success.

## 2026-03-12 — Canonical sale document JE (Fresh posting gate)

Payment JEs are stored as `journal_entries.reference_type = 'sale'` with **`payment_id` set**. Document certification’s **Fresh posting gate (sale)** and `saleAccountingService` now count and guard **only** canonical document JEs (`payment_id IS NULL`). Repair + unique index: **`migrations/20260312_canonical_sale_document_je_unique_and_repair.sql`**. Details: parent **[`../ACCOUNTING_INTEGRITY_LAB_RESULT.md`](../ACCOUNTING_INTEGRITY_LAB_RESULT.md)** § *2026-03-12 — Fresh posting gate*.

## 2026-03-12 — Canonical purchase document JE (Fresh posting gate)

Purchase document JE handling is now also canonicalized: only `reference_type='purchase'` + `payment_id IS NULL` rows count as the purchase document JE. Duplicate repair + unique index: **`migrations/20260312_canonical_purchase_document_je_unique_and_repair.sql`**. Details: parent **[`../ACCOUNTING_INTEGRITY_LAB_RESULT.md`](../ACCOUNTING_INTEGRITY_LAB_RESULT.md)** § *2026-03-12 — Fresh posting gate: canonical purchase*.

## 2026-03-12 — Live `converted` column 400 + posting-gate sample

See the parent file section **“Live posting-gate sample + converted filter (400 fix)”** and project audit **[`../LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md`](../LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md)**.

**Summary:** Production was missing `converted` / `converted_to_document_id` on `sales` and `purchases`; migrations were applied on VPS Postgres; app now uses RPC-backed capability flags so list/lab queries do not hard-fail or spam 400 when schema is ahead/behind. **Final-only sale posting and final|received purchase posting rules were not weakened.**
