# Add Entry V2 – Acceptance Checklist

After deploying AddEntryV2 as default, run one real entry per type and verify.

## A. Pure Journal
- [ ] Create one Pure Journal (Dr/Cr any two non-payment accounts, amount, date).
- [ ] **Journal Entries**: Entry appears with reference_type = journal, no payment_id.
- [ ] **Day Book**: Entry appears (if Day Book includes all JEs or non-payment JEs).
- [ ] **Roznamcha**: Entry does **not** appear (pure journal excluded from Roznamcha).
- [ ] **Payments**: No new row in `payments`.
- [ ] **Ledger**: No supplier/worker/courier ledger impact.

## B. Customer Receipt
- [ ] Create one Customer Receipt (customer, amount, payment account, date).
- [ ] **Payments**: One row, reference_type = `manual_receipt`, contact_id = customer.
- [ ] **Journal Entries**: One JE with payment_id set; Dr payment account, Cr AR (1100).
- [ ] **Day Book**: Entry appears.
- [ ] **Roznamcha**: Entry appears (payment movement).
- [ ] **Customer ledger**: Consistent with AR/customer reporting if applicable.

## C. Supplier Payment
- [ ] Create one Supplier Payment (supplier, amount, payment account, date).
- [ ] **Payments**: One row, reference_type = `manual_payment`, contact_id = supplier contact id.
- [ ] **Journal Entries**: One JE with payment_id; Dr AP (2000), Cr payment account.
- [ ] **Day Book**: Entry appears.
- [ ] **Roznamcha**: Entry appears.
- [ ] **Supplier Ledger**: One ledger_entries row, source = `payment`, reference_id = payment.id; ledger_master.ledger_type = supplier, entity_id = supplier contact id. UI refresh shows the payment.

## D. Worker Payment
- [ ] Create one Worker Payment (worker, amount, payment account, date).
- [ ] **Payments**: One row, reference_type = `worker_payment`, reference_id = worker id.
- [ ] **Journal Entries**: One JE with payment_id; Dr Worker Payable (2010), Cr payment account.
- [ ] **Day Book**: Entry appears.
- [ ] **Roznamcha**: Entry appears.
- [ ] **Worker ledger**: Recorded via studioProductionService; worker ledger/report shows payment.

## E. Expense Payment
- [ ] Create one Expense Payment (expense account, amount, payment account, date).
- [ ] **Payments**: One row, reference_type = `expense`.
- [ ] **Journal Entries**: One JE with payment_id; Dr expense account, Cr payment account.
- [ ] **Day Book**: Entry appears.
- [ ] **Roznamcha**: Entry appears.

## F. Internal Transfer
- [ ] Create one Internal Transfer (from payment account, to payment account, amount, date).
- [ ] **Payments**: No new row (current design: JE only).
- [ ] **Journal Entries**: One JE, reference_type = `transfer`, payment_id NULL; Dr to-account, Cr from-account.
- [ ] **Day Book**: Entry appears.
- [ ] **Roznamcha**: Depends on policy; if transfer should appear, future change may add optional payments row.

## G. Courier Payment
- [ ] Create one Courier Payment (courier from couriers master, amount, payment account, date).
- [ ] **Payments**: One row, reference_type = `courier_payment`, reference_id = courier id (or contact id).
- [ ] **Journal Entries**: One JE with payment_id; Dr Courier Payable (resolved via get_or_create_courier_payable_account), Cr payment account.
- [ ] **Day Book**: Entry appears.
- [ ] **Roznamcha**: Entry appears.
- [ ] **Courier Reports / Courier Ledger**: Payment visible; ledgerUpdated dispatched for courier.
- [ ] **COA**: Default Chart of Accounts (Professional, top-level only) does **not** show courier child accounts; "Show sub-accounts" reveals them for admin.

## Verification SQL
- Run `docs/accounting/ADD_ENTRY_V2_VERIFICATION.sql` with your `company_id`:
  - Query 1: Counts by reference_type.
  - Query 2: Zero JEs (V2 payment types) touching payment account with payment_id NULL.
  - Query 3: No payment with <> 1 linked JE.
  - Queries 4–7: Spot-check supplier ledger, pure journal, transfer, courier payments.

## Sign-off
- [ ] All 7 types executed once.
- [ ] No duplicate JE for same payment.
- [ ] No duplicate ledger entry for same payment (supplier/worker/courier).
- [ ] Old Add Entry (AccountingTestPage) still available when `USE_ADD_ENTRY_V2 = false` in AccountingDashboard.
