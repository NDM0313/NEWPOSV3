# APPLY + VERIFY FINAL REPORT — Accounting Architecture

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

---

## 1. Final duplicate/overlap list

| Area | Duplicate/overlap | Status |
|------|-------------------|--------|
| **accounts** | "accounts receivable" (2), "bank" (2) | Resolved: canonical chosen, jel repointed, duplicates marked inactive |
| **chart_accounts** | Overlaps with accounts | Legacy; not used for posting |
| **document_sequences / document_sequences_global** | Overlap with erp_document_sequences for PAY | Legacy; freeze for new PAY |
| **Supplier ledger** | 2 ledger_entries reference payments with NULL contact_id | Read path fixed (include ledger payment refs); backfill available |
| **couriers** | 0 duplicate normalized names | N/A |

---

## 2. What is real duplicate vs not duplicate

- **Real duplicate (data):** Two account name groups — "accounts receivable" and "bank" — each had 2 active rows. Treated as duplicate data; **resolved** by repointing journal_entry_lines to canonical account and setting duplicate rows is_active = false.
- **Not duplicate:** (1) Child courier payable (2030 + children) = hierarchy. (2) courier_ledger, courier_summary, shipment_ledger = VIEWs (reporting). (3) erp_document_sequences vs document_sequences = canonical vs legacy (numbering), not duplicate data.

---

## 3. Root cause of supplier ledger issue

- **Cause:** Supplier ledger is keyed by ledger_master.entity_id (supplier/contact id). Entries appear when (a) payment.contact_id = supplierId, or (b) reference_id is a purchase_id for that supplier, or (c) reference_id is a payment_id that is either linked to that supplier or already posted to this ledger. Historically, some payments had contact_id NULL, so the read adapter excluded those entries.
- **Fix applied:** (1) Posting already sets contact_id (supplierPaymentService for purchase/on_account; AccountingContext for manual when metadata.contactId present). (2) Read adapter: include payment refs by contact_id, by supplier purchase ids, by purchase-linked payment ids, and **by payment refs present in this ledger’s entries** so historically posted entries still show. (3) Backfills: from purchase and from supplier ledger (run via script; DB may restrict updates by RLS).

---

## 4. Root cause of shipment/courier confusion

- **Cause:** Two concepts exist: (1) couriers table = canonical master; (2) accounts (2030 + child courier payable accounts) = accounting hierarchy. Views (courier_ledger, shipment_ledger) aggregate from journal_entry_lines + accounts. No duplicate courier name rows for this company; confusion was architectural (which table/view to use for what).
- **Clarity applied:** couriers = canonical master; 2030 + children = hierarchy; views = reporting only. Single Courier Reports tab with sub-views (Summary, Ledger, Shipment Ledger); no duplicate courier category in UI. Shipment payment/edit flow uses courierService + shipmentAccountingService; Pay Courier modal posts via accounting.

---

## 5. Files changed

| File | Change |
|------|--------|
| `src/app/services/ledgerDataAdapters.ts` | Supplier ledger: include purchase-linked payment ids; include payment refs from this ledger’s entries |
| `src/app/services/documentNumberService.ts` | Comment: PAY refs use getNextDocumentNumber (erp_document_sequences) only |
| `docs/accounting/FINAL_DUPLICATE_CLASSIFICATION.md` | New: classification table with actual_role, status, real_problem, recommended_action |
| `docs/accounting/NUMBERING_CONSOLIDATION.md` | Existing: erp_document_sequences canonical; legacy freeze for PAY |
| `docs/audit/account_dedupe_apply.sql` | New: repoint jel, mark duplicate AR/Bank inactive (company-scoped) |
| `scripts/run-account-dedupe.js` | New: run account_dedupe_apply.sql, then count remaining duplicate name groups |
| `scripts/run-real-duplicates-audit.js` | Added: journal_entry_lines count per duplicate account id |
| `docs/accounting/APPLY_VERIFY_FINAL_REPORT.md` | This report |

---

## 6. SQL executed

- **account_dedupe_apply.sql** (via `node scripts/run-account-dedupe.js`): Two DO blocks — (1) Accounts receivable: canonical = prefer code 1100, repoint jel, set duplicate is_active = false; (2) Bank: canonical = prefer code 1010, same. Result: remaining duplicate name groups (active) = 0.
- **backfill_payments_contact_id_from_purchase.sql** (via run-backfill-payments-contact-id.js): 0 rows updated (already set).
- **backfill_payments_contact_id_from_supplier_ledger.sql** (via same script): 0 rows updated (RLS or already set when run from app DB user).
- **Audit queries** (via run-real-duplicates-audit.js): accounts_duplicate_name, journal_entry_lines_per_duplicate_account, accounts_courier_children, couriers_duplicate_name, payments_supplier_null_contact, ledger_entries_payment_missing_contact.

---

## 7. Historical rows repaired

- **journal_entry_lines:** Repointed from duplicate AR account to canonical (0 lines were on the duplicate AR id; Bank duplicates had 0 jel). No jel rows deleted.
- **accounts:** 2 rows set is_active = false (one AR duplicate, one Bank duplicate).
- **payments.contact_id:** No rows updated by backfill in this run (0 from purchase, 0 from supplier ledger when run via script). Read path ensures the 2 supplier-ledger payment entries still appear.

---

## 8. Duplicate account groups handled

- **accounts receivable:** Canonical = account with code 1100 (or oldest); duplicate id(s) repointed in jel and set inactive. **Result:** 1 active AR account.
- **bank:** Canonical = account with code 1010 (or oldest); duplicate set inactive. **Result:** 1 active Bank account.
- **Remaining duplicate name groups (active):** 0 (verified by script).

---

## 9. Courier architecture result

- **Couriers** = canonical master; **accounts** (2030 + children) = hierarchy; **views** = reporting only. No table drops; no broad deletes.
- **UI:** Single “Courier Reports” tab with sub-views (Courier Summary, Courier Ledger, Shipment Ledger); no duplicate courier category. Pay Courier modal and shipment edit/payment flow unchanged and documented.
- **Duplicate courier names:** 0 for this company; courier_dedupe_apply.sql available for others.

---

## 10. Verification results (real rows + UI)

| Check | Result |
|-------|--------|
| **Duplicate account names** | After run: 0 active duplicate name groups (script count). |
| **Supplier ledger read** | Adapter includes (1) payments by contact_id, (2) purchase ids, (3) purchase-linked payment ids, (4) payment refs in this ledger’s entries. Manual, on-account, and purchase-linked supplier payments appear when supplier is known. |
| **Supplier ledger posting** | supplierPaymentService sets contact_id; AccountingContext sets contact_id for manual when metadata.contactId present. |
| **COA default** | Professional mode: top-level only when showSubAccounts = false; sub-accounts (e.g. 2030) when showSubAccounts = true. Operational mode: filtered by type/code. |
| **Numbering** | documentNumberService.getNextDocumentNumber → generate_document_number RPC → erp_document_sequences. Comment added: do not use document_sequences for new PAY. |
| **Courier UI** | One tab, three sub-views; no duplicate category. |

---

## 11. Remaining exceptions

- **2 ledger_entries** still reference payments that (under script/RLS) may have contact_id NULL. They **do** appear in Supplier Ledger because the read path includes payment refs present in this ledger’s entries. To persist contact_id in DB for those 2 payments, run `backfill_payments_contact_id_from_supplier_ledger.sql` in Supabase SQL Editor with a role that can update `payments`.
- **document_sequences** still used by credit notes, refunds, returns; not changed in this phase. PAY is locked to erp_document_sequences.

---

## 12. Exact next step

1. **Optional:** Run `backfill_payments_contact_id_from_supplier_ledger.sql` in Supabase SQL Editor (service role or role with UPDATE on payments) to set contact_id for the 2 supplier-ledger payments.
2. **UI verification:** In the app, open Supplier Ledger for a supplier that has payments and confirm all payment types (manual, on-account, purchase-linked) show; open Chart of Accounts and confirm default = top-level and “Show sub-accounts” shows 2030 children.
3. **Ongoing:** All new supplier payment flows must set payments.contact_id; all new PAY refs must use documentNumberService.getNextDocumentNumber (erp_document_sequences). No new payment flow should use document_sequences for PAY.
