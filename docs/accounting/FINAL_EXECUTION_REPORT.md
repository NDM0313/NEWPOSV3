# Final Execution Report — Accounting Architecture (FULL EXECUTION MODE)

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

---

## 1. Final duplicate/overlap list

| Object / area | Duplicate/overlap | Notes |
|---------------|-------------------|--------|
| **accounts** | 2 name-duplicate groups: "accounts receivable" (2 ids), "bank" (2 ids) | Real data duplicates; no destructive cleanup in this step |
| **chart_accounts** | Overlaps with **accounts** | Legacy; do not use for new posting |
| **document_sequences / document_sequences_global** | Overlap with **erp_document_sequences** | Legacy for PAY; freeze for new payment numbering |
| **couriers** | 0 duplicate normalized names for this company | No courier dedupe needed |
| **ledger_entries (supplier)** | 2 entries reference payments with NULL contact_id | Read path fixed so they still show; backfill available for DB fix |

---

## 2. What is actually duplicate vs not duplicate

- **Actually duplicate (data):** Two account name groups: "accounts receivable" and "bank" each have 2 rows (same company, same normalized name). Treated as duplicate data; merge/cleanup out of scope for this step.
- **Not duplicate:**  
  - Child courier payable (2030) and future children under it = hierarchy, not duplicates.  
  - **courier_ledger**, **courier_summary**, **shipment_ledger** = views (reporting); not duplicate tables.  
  - **erp_document_sequences** vs **document_sequences** = canonical vs legacy; not duplicate data.

---

## 3. Root cause of supplier ledger issue

- **Cause:** Supplier ledger visibility depends on (a) `payments.contact_id` for payment-based entries, and (b) ledger_entries.reference_id being accepted as payment_id or purchase_id.  
- **Gaps:** (1) Some historical payments (purchase-linked or manual) had `contact_id` NULL, so adapter excluded them. (2) Adapter did not treat payment IDs that appear in this ledger’s entries as valid when payment.contact_id was NULL.  
- **Fix:** (1) Posting already sets `contact_id` (supplierPaymentService, AccountingContext). (2) Backfills added: from purchase, and from supplier ledger entity_id. (3) Read path: include payment refs by contact_id, by purchase ids, by purchase-linked payment ids, and **by payment refs present in this ledger’s entries** so historically posted entries still show.

---

## 4. Root cause of courier/COA clutter

- **Courier:** No duplicate courier names found for this company; no clutter from duplicate courier rows.  
- **COA:** Default view is already top-level only; "Show sub-accounts" shows children (e.g. 2030 Courier Payable). Child under 2030 = 1 row; hierarchy, not clutter. Duplicate account names ("accounts receivable", "bank") are data duplicates, not hierarchy.

---

## 5. Files changed

| File | Change |
|------|--------|
| `src/app/services/ledgerDataAdapters.ts` | Supplier ledger: include purchase-linked payment ids; include all payment refs that appear in this ledger’s entries so entries with NULL payment.contact_id still show |
| `docs/accounting/NUMBERING_CONSOLIDATION.md` | New: erp_document_sequences canonical; document_sequences* legacy; no new PAY from legacy |
| `docs/audit/backfill_payments_contact_id_from_supplier_ledger.sql` | New: backfill payments.contact_id from ledger_master.entity_id for supplier ledger entries |
| `scripts/run-backfill-payments-contact-id.js` | Run purchase backfill + supplier-ledger backfill + count of remaining NULL contact_id |
| `docs/audit/courier_dedupe_apply.sql` | New: preview + idempotent apply for courier dedupe (repoint shipments, mark inactive); 0 dupes for company |
| `scripts/run-real-duplicates-audit.js` | New: run duplicate/audit queries, print counts + samples; added entity_id and payments detail for missing-contact entries |
| `docs/accounting/FINAL_EXECUTION_REPORT.md` | This report |

---

## 6. SQL executed

- **Backfill (run via script):**  
  - `backfill_payments_contact_id_from_purchase.sql`: 0 rows updated (already set).  
  - `backfill_payments_contact_id_from_supplier_ledger.sql`: 0 rows updated (RLS or already set when run from app env).  
- **Audit (run via `node scripts/run-real-duplicates-audit.js`):** Counts and sample rows for duplicate account names, courier children, duplicate courier names, supplier payments NULL contact_id, ledger entries with payment missing contact_id.  
- **Courier dedupe:** Apply SQL not run (0 duplicate courier name groups).

---

## 7. Historical rows repaired

- No rows updated by backfills in this run (0 from purchase, 0 from supplier ledger).  
- Read path now shows the 2 supplier-ledger entries whose payment has NULL contact_id (by accepting payment refs that appear in this ledger’s entries).

---

## 8. Duplicate courier groups merged

- **0** duplicate courier name groups for this company; no merges performed.

---

## 9. Duplicate account-name groups handled

- **Not merged.** Two groups identified: "accounts receivable" (2), "bank" (2). Classified and documented; no DELETE/merge in this step per constraints.

---

## 10. Verification results

| Check | Result |
|-------|--------|
| A) Manual supplier payment | Posting sets contact_id when metadata.contactId present; read path includes by contact_id and by ledger payment refs. |
| B) On-account supplier payment | supplierPaymentService sets contact_id; read path includes. |
| C) Purchase-linked supplier payment | contact_id from purchase.supplier_id; read path includes by purchase ids and purchase-linked payment ids + ledger payment refs. |
| D) Courier duplicate group | 0 groups; N/A. |
| E) COA default view | Top-level only when showSubAccounts = false (AccountingDashboard). |
| F) COA with sub-accounts | Children shown when showSubAccounts = true. |

---

## 11. Remaining exceptions

- **2 account duplicate groups** ("accounts receivable", "bank"): still 2 rows each; optional future merge.  
- **2 ledger entries** reference payments that (under current RLS/connection) may still have contact_id NULL; they now **show** in Supplier Ledger due to read-path change. To persist contact_id in DB, run `backfill_payments_contact_id_from_supplier_ledger.sql` in Supabase SQL Editor (service role / full access).

---

## 12. Exact next step

1. **Optional:** Run `backfill_payments_contact_id_from_supplier_ledger.sql` in Supabase SQL Editor (with role that can update `payments`) to set contact_id for the 2 payments tied to supplier ledger entries.  
2. **Optional:** Resolve duplicate account names (e.g. pick canonical "Accounts Receivable" and "Bank", repoint references, then archive or merge).  
3. **UI verification:** In app, open Supplier Ledger for a supplier that has the 2 previously-missing payments and confirm lines appear; create manual/on-account/purchase-linked supplier payment and confirm they appear.  
4. **Numbering:** All new PAY flows use `documentNumberService` → `erp_document_sequences`; no further code change for numbering in this step.
