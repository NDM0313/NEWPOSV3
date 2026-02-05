# Reference Numbering – LOCKED RULES

## Goal
- Every reference number: **predictable**, **readable**, **2–3 letter prefix**, from **one central system** (Settings → Numbering Rules).
- No module uses another module’s counter. **No shared counters.**

---

## LOCKED PREFIX TABLE (FINAL – DO NOT CHANGE)

| Module           | Prefix | Example   | Use |
|------------------|--------|-----------|-----|
| **Regular Sale**  | **SL** | SL-0001   | Customer Ledger, Sales list, Accounting. |
| **Studio Sale**   | **STD**| STD-0001  | Studio Production, Worker Jobs, references. |
| **Purchase**      | **PUR**| PUR-0001  | Supplier Ledger, payments. |
| **Expense**       | **EXP**| EXP-0001  | Expense entries, User Ledger. |
| **Payment**       | **PAY**| PAY-0001  | All payments (customer, supplier, worker). Single counter. |
| **Job (Worker)**  | **JOB**| JOB-0001  | worker_ledger_entries (studio stage payable). |
| **Journal**       | **JV** | JV-0001   | Manual journal vouchers. |

- **Settings → Numbering Rules:** Each row above has its own prefix + next number. No module shares a counter.
- **Frontend:** `useDocumentNumbering` types: `invoice` → SL, `studio` → STD, `purchase` → PUR, `expense` → EXP, `payment` → PAY, `job` → JOB, `journal` → JV.
- **Backend:** Document numbers come from central numbering (or `settingsService.getNextDocumentNumber` for job in studioProductionService).

---

## Where Numbers Are Generated

- **Hook:** `src/app/hooks/useDocumentNumbering.ts` – types include `payment`, `job`, `journal`; purchase default **PUR-**.
- **Sales:** `SalesContext` / `SaleForm` – `invoice` (SL) or `studio` (STD); payments use `payment` (PAY).
- **Purchase:** `PurchaseContext` – `purchase` (PUR); payments use PAY from UnifiedPaymentDialog.
- **Expense:** `ExpenseContext` – `expense` (EXP).
- **Worker job:** `studioProductionService` – when creating `worker_ledger_entries` for a stage, calls `settingsService.getNextDocumentNumber(companyId, branchId, 'job')` and stores in `document_no`.
- **Payment ref:** SalesContext, UnifiedPaymentDialog (customer/supplier/worker) – `generateDocumentNumber('payment')` then `incrementNextNumber('payment')`.
- **Worker ledger display:** `ledgerDataAdapters.ts` – uses `document_no` (JOB-xxxx) when present for referenceNo.

---

## Migration

- `worker_ledger_entries.document_no` (nullable) – see `migrations/worker_ledger_document_no.sql`.
- `document_sequences`: ensure rows for `payment`, `job`, `journal` (created when user saves Numbering Rules in Settings).

---

*Rules locked. Do not change prefixes or share counters across modules.*
