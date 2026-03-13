# ERP Bugfix: On-Account Payments (Direct Contact Payment Without Invoice/Bill)

**Date:** 2026-03-13  
**Issue:** From contact/customer/supplier side, "Receive Payment" / "Pay Supplier" failed because Sale ID / Purchase ID was required. Business requires on-account payments (direct ledger payment without invoice/bill reference).

---

## Root cause

- **UnifiedPaymentDialog** required `referenceId` (sale or purchase UUID) for customer and supplier flows and showed "Sale ID is required" / "Purchase ID is required" when it was missing.
- **ContactsPage** opens the payment dialog without a document (no `referenceId`), so every direct payment from the contact row failed.
- **DB and services** assumed every payment was document-linked: `saleService.recordPayment(saleId, ...)` and `purchaseService.recordPayment(purchaseId, ...)` require a document id; some schemas had `reference_id` NOT NULL.

---

## Fix

### 1. Schema (migration)

- **File:** `migrations/payments_on_account_null_reference.sql`
- Allow nullable `reference_type` and `reference_id` on `payments` (only if currently NOT NULL).
- Ensure `payments.contact_id` exists for on-account linkage.
- On-account rows: `reference_type = 'on_account'`, `reference_id = null`, `contact_id = contact UUID`.

### 2. Services

- **saleService.recordOnAccountPayment(contactId, contactName, amount, paymentMethod, accountId, companyId, branchId, paymentDate?, options?)**
  - Inserts into `payments` with `payment_type = 'received'`, `reference_type = 'on_account'`, `reference_id = null`, `contact_id = contactId`.
  - Returns `{ id, reference_number }`.
- **purchaseService.recordOnAccountPayment(...)**  
  - Same pattern with `payment_type = 'paid'`.

### 3. Accounting context

- **recordOnAccountCustomerPayment(params)**  
  - Creates journal entry: Dr selected payment account (Cash/Bank), Cr Accounts Receivable.  
  - Uses `metadata.debitAccountId` (selected account) and `metadata.customerId` for ledger.
- **createEntry**  
  - When `metadata.debitAccountId` is set, uses that account for the debit line (so the chosen payment account is used).

### 4. UnifiedPaymentDialog

- **Customer**
  - If `!referenceId` (on-account): resolve branch (first branch if `branchId === 'all'`), call `saleService.recordOnAccountPayment(entityId, ...)`, then `accounting.recordOnAccountCustomerPayment(...)`.
  - If `referenceId`: existing flow (saleService.recordPayment + recordSalePayment).
- **Supplier**
  - If `!referenceId`: resolve branch, call `purchaseService.recordOnAccountPayment(entityId, ...)`, then `accounting.recordSupplierPayment({ supplierName, supplierId, amount, paymentMethod, referenceNo })` (no `purchaseId`).
  - If `referenceId`: existing flow (purchaseService.recordPayment + recordSupplierPayment with purchaseId).
- **Validation**
  - When `referenceId` is missing, allow any positive amount (no cap by outstanding). When present, keep `amount <= effectiveOutstanding`.

### 5. ContactsPage

- Pass contact UUID as `entityId` for the payment dialog: `entityId={selectedContact.uuid ?? selectedContact.id?.toString() ?? ''}` so `contact_id` and ledger linkage use the correct contact.

---

## Files changed

- `migrations/payments_on_account_null_reference.sql` (new)
- `src/app/services/saleService.ts` — added `recordOnAccountPayment`
- `src/app/services/purchaseService.ts` — added `recordOnAccountPayment`
- `src/app/context/AccountingContext.tsx` — added `recordOnAccountCustomerPayment`, `OnAccountCustomerPaymentParams`, `metadata.debitAccountId` handling in `createEntry`
- `src/app/components/shared/UnifiedPaymentDialog.tsx` — on-account branches for customer/supplier, validation update
- `src/app/components/contacts/ContactsPage.tsx` — `entityId` from contact uuid

---

## Verification

- From Contacts → Customer → "Receive Payment": enter amount and account → payment saves with `reference_type = 'on_account'`, `reference_id = null`, `contact_id` set; journal entry Dr Cash/Bank Cr AR; customer ledger shows the payment.
- From Contacts → Supplier → "Pay Supplier": same for supplier; journal entry Dr AP Cr Cash/Bank; supplier ledger shows the payment.
- From Sale detail / Purchase detail with invoice/bill: existing document-linked payment flow unchanged (same validation and posting).

---

## Rollback

- Revert code changes; re-run migration only if you need to re-enforce NOT NULL on `reference_type`/`reference_id` (not recommended). Existing on-account rows remain valid.
