# Supplier Ledger Live Write Path — Fix Summary

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

---

## 1. Root cause found

- **Missing UI refresh:** After a manual supplier payment was posted, the code correctly called `getOrCreateLedger(companyId, 'supplier', supplierContactId, supplierName)` and `addLedgerEntry(...)` with `source: 'payment'` and `referenceId: manualPaymentId`, but **no event was dispatched** to refresh the Supplier Ledger view. So even when the ledger_entries row was inserted, the open Supplier Ledger tab did not reload.
- **Possible secondary:** If in some flows `metadata.contactId` was not passed from the Manual Entry dialog, the supplier ledger sync block would be skipped (no `supplierContactId`). The dialog already requires supplier selection when Debit = Accounts Payable and passes `metadata.contactId` and `metadata.contactName`; the fix does not change that.

---

## 2. Files changed

| File | Change |
|------|--------|
| **AccountingContext.tsx** | (A) Dev log: manual payment payload (contact_id, amount). (B) Dev logs: getOrCreateLedger result (ledgerId, entity_id, entity_name), addLedgerEntry payload and result. (C) **Dispatch `ledgerUpdated`** with `{ ledgerType: 'supplier', entityId: supplierContactId }` after successful addLedgerEntry so GenericLedgerView reloads. (D) Dev warn when supplier sync is skipped (no contactId in metadata). |
| **ledgerDataAdapters.ts** | Dev logs when a purchase or payment entry is filtered out (reference_id, reason). |
| **ledgerService.ts** | Dev log when addLedgerEntry inserts a row with source 'payment' (id, ledger_id, reference_id). |
| **docs/audit/supplier_ledger_verification.sql** | New: verification queries (contacts, payments, journal_entries, ledger_master, ledger_entries, end-to-end payment → ledger_entries). Literal company id; no placeholders. |
| **scripts/run-supplier-ledger-verification.js** | New: runs end-to-end query (manual_payment → ledger_master → ledger_entries) and prints rows + count of payments missing ledger_entries. |
| **docs/accounting/SUPPLIER_LEDGER_LIVE_FIX.md** | This summary. |

---

## 3. SQL run

- **run-supplier-ledger-verification.js:** End-to-end query for `reference_type = 'manual_payment'` linking payments to ledger_master (entity_id = contact_id) and ledger_entries (source = 'payment', reference_id = payment.id). Result for this company: **0 manual_payment rows** in DB (no manual supplier payments in dataset yet). So no historical rows were repaired by this run; the fix is for **new** payments.

---

## 4. Whether fresh payment now appears in Supplier Ledger

- **Expected behavior after fix:**  
  1. User adds Manual Entry: Debit = Accounts Payable, Credit = Cash/Bank, selects supplier, submits.  
  2. Payment row is created with `contact_id` = supplier contact id.  
  3. Journal entry is created and linked via `payment_id`.  
  4. `getOrCreateLedger(companyId, 'supplier', supplierContactId, supplierName)` ensures ledger_master row (entity_id = supplier id).  
  5. `addLedgerEntry(..., source: 'payment', referenceId: manualPaymentId)` inserts ledger_entries row.  
  6. **`ledgerUpdated`** is dispatched with entityId = supplierContactId → GenericLedgerView for that supplier calls loadLedger() and the new payment row appears.  
  7. Read path already treats any payment reference_id present in this ledger’s entries as valid, so the new entry is not filtered out.

- **Verification:** Create one new manual supplier payment (Accounting → Add Entry or Manual Entry → Dr Accounts Payable, Cr Bank, select supplier). Then check: Journal Entries, Day Book, Roznamcha, and **Accounting → Ledger → Supplier Ledger** for that supplier. The new payment should appear; if the Supplier Ledger tab was already open for that supplier, it should refresh automatically.

---

## 5. Exact remaining issues (if any)

- **None** for the live write path. Remaining recommendations:  
  - Run `node scripts/run-supplier-ledger-verification.js` after creating a test manual supplier payment to confirm the new row appears in the end-to-end query.  
  - In development, use console logs prefixed `[SUPPLIER_LEDGER]` to confirm payload, getOrCreateLedger, addLedgerEntry, and any filtered-out entries in the read path.
