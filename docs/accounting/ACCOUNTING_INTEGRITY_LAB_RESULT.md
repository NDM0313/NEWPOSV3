# Accounting Integrity Lab — RESULT (accounting folder copy)

The maintained lab deliverable is **[`../ACCOUNTING_INTEGRITY_LAB_RESULT.md`](../ACCOUNTING_INTEGRITY_LAB_RESULT.md)**.

## 2026-03-20 — Document certification vs company reconciliation

See parent doc **“Two-layer verification (document vs company)”**. Company-wide TB/BS/AR/AP no longer run automatically after action-runner success.

## 2026-03-12 — Live `converted` column 400 + posting-gate sample

See the parent file section **“Live posting-gate sample + converted filter (400 fix)”** and project audit **[`../LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md`](../LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md)**.

**Summary:** Production was missing `converted` / `converted_to_document_id` on `sales` and `purchases`; migrations were applied on VPS Postgres; app now uses RPC-backed capability flags so list/lab queries do not hard-fail or spam 400 when schema is ahead/behind. **Final-only sale posting and final|received purchase posting rules were not weakened.**
