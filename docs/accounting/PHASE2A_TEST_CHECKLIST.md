# PHASE2A Test Checklist

Run these checks in QA with the same company and branch on web + mobile.

## 1) Worker payment canonical chain (mobile-origin)

- [ ] From mobile `Accounts -> Worker Payment`, post one worker payment.
- [ ] Verify one `payments` row exists:
  - `reference_type = 'worker_payment'`
  - `reference_id = workerId`
  - `reference_number = generated PAY ref`
- [ ] Verify one linked `journal_entries` row exists for same payment (`payment_id` set).
- [ ] Verify two `journal_entry_lines` for that JE:
  - Dr worker payable/advance account
  - Cr selected payment account
- [ ] Verify one `worker_ledger_entries` payment row exists for same reference/journal.
- [ ] Re-submit same request payload (simulate retry) and verify no duplicate rows created in any of the above layers.

## 2) Customer balance parity (branch policy)

- [ ] Select branch A in mobile and web.
- [ ] Open customer ledger/list in both.
- [ ] Verify same customer receivable uses same branch policy and closely matches.
- [ ] Repeat with `All/default` branch and compare again.

## 3) Supplier payable parity (source definition)

- [ ] Confirm mobile `PayablesReport` header source label shows document-based source.
- [ ] Confirm web payables tab source label shows document-based source.
- [ ] For a supplier with 2+ unpaid purchases, verify totals and invoice/PO due list are consistent with document due.

## 4) Dashboard semantics parity

- [ ] Web accounting dashboard cards show GL-derived labels.
- [ ] Mobile dashboard financial cards show GL labels and values change when new JE is posted.
- [ ] Verify both sides no longer present mobile-only `sales - purchases` as accounting net profit.

## 5) No new legacy dependency

- [ ] Search changed files for legacy table names:
  - `chart_accounts`
  - `account_transactions`
  - `accounting_audit_logs`
  - `automation_rules`
  - `ledger_master`
  - `ledger_entries`
- [ ] Confirm zero new usage introduced.

## 6) Regression smoke checks

- [ ] Mobile supplier payment still works.
- [ ] Mobile general journal entry still works.
- [ ] Mobile customer ledger opens without runtime errors.
- [ ] Web accounting dashboard tabs still render correctly.

## Suggested evidence capture

- [ ] Screenshot of worker payment success screen.
- [ ] SQL screenshots for all four table entries.
- [ ] Side-by-side web/mobile customer balance screenshot under same branch.
- [ ] Dashboard screenshot (web + mobile) showing GL labels.

