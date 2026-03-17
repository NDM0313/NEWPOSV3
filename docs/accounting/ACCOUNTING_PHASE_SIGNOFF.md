# Accounting Phase Signoff

**Phase:** Final Accounting Freeze + Acceptance Signoff  
**Date:** 2026-03-17  
**Primary target:** NEW BUSINESS (`c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee`)  
**Reference:** OLD BUSINESS (`eb71d817-b87e-4195-964b-7b5321b480f5`)

---

## 1. Closed issues list

Issues addressed and verified in the accounting stabilization phase (documented in ERP_COA_REVIEW_AND_ISSUES_TRACKER_v4.md and execution runs):

| Item | Description | Applied fix |
|------|-------------|-------------|
| **Issue 10 / 24** | Studio Costs summary cards vs worker-wise table mismatch | Summary totals derived from same worker breakdown in studioCostsService (journal path). |
| **Issue 11** | Rental accounting/reporting reconciliation | RentalContext.addPayment posts via recordRentalDelivery; default accounts include Rental Advance (2020) and Security Deposit (2011). |
| **Issue 12 (Return)** | Purchase return not posting to accounting | recordPurchaseReturn added; called from PurchaseReturnForm and StandalonePurchaseReturnForm after finalize. |
| **AR/AP/sale/payment** | Various FIXED items in tracker (receivable/payable classification, payment journal, etc.) | As per tracker sections 2–3 and prior fixes. |

---

## 2. Remaining exceptions list

The following remain **open** (no change in this phase; do not reopen unless evidence of blocker):

- **Issue 11 (Courier)** — Courier payable reporting flow incomplete; control/sub-accounts for courier payables.
- **Issue 12 (Inventory report)** — Inventory valuation report missing product names/SKUs (join repair).
- **Issue 13** — Owner equity / retained earnings model missing.
- **Issue 25** — Worker Management totals vs Studio order/payables (single source).
- **Issue 26** — Cost of Production account polluted by generic expenses.
- **Issue 27** — Manual accounting correction workflow (edit/reverse/repost) for posted entries.
- **Tracker 3.2** — Shipping charge not fully synced to sale total / customer ledger.
- **Issue 16** — Purchase edit not re-posting accounting correctly.
- **Rental pickup duplicate** (3.19) — Pickup confirmation idempotency / duplicate payment prevention.

---

## 3. Whether accounting is production-ready

- **Canonical posting:** Yes. All active flows post through `journal_entries` + `journal_entry_lines` and/or `payments` as defined in ACCOUNTING_FREEZE.md.
- **Trial balance:** Verified balanced (sum of line imbalances = 0) for both NEW and OLD business at signoff run.
- **Reports:** Trial Balance, Balance Sheet, Dashboard, Studio Costs, Customer/Supplier/Worker ledgers, Sales Profit, and return flows use canonical sources; known gaps (equity, inventory report SKUs, shipping sync) are documented and are not blockers for freeze.
- **Verdict:** Accounting is **production-ready for freeze**: structure is stable, posting paths are defined, and remaining items are tracked as post-freeze improvements.

---

## 4. Whether NEW BUSINESS is clean for fresh operations

- **Yes.** Verification at signoff:
  - Accounts: 9 (active); includes inventory (1200), payment-type accounts.
  - Journal entries: 0; payments: 0; rentals: 0; studio stage JEs: 0.
  - Trial balance: balanced (0 imbalance).
  - No duplicate account names.
  - Default accounts (including Rental Advance 2020, Security Deposit 2011) are ensured on first use via defaultAccountsService.
- NEW BUSINESS is in a **clean zero state** and ready for fresh transactions under the frozen accounting model.

---

## 5. Whether OLD BUSINESS still has historical data limitations

- OLD BUSINESS has **historical data** (16 accounts, 2 JEs, 6 payments). Trial balance verified balanced.
- **Limitations:** Any legacy data (e.g. account 2020 named "Accounts Payable" instead of "Rental Advance") remains as-is; no destructive cleanup was performed. Reports and TB/BS run correctly; courier/equity/inventory-report open items apply equally to OLD and NEW.

---

## 6. Exact recommended next phase after accounting signoff

1. **Operate** on NEW BUSINESS with the frozen model (customer receipt, supplier payment, expense, rental, studio, sale/purchase, returns) and confirm in production use.
2. **Address remaining exceptions** in priority order: (a) Courier payable control/sub-accounts, (b) Purchase edit re-post (Issue 16), (c) Shipping–sale total sync, (d) Equity/retained earnings (Issue 13), (e) Inventory valuation report SKUs (Issue 12), (f) Studio Cost of Production vs generic expense separation (Issue 26), (g) Manual correction workflow (Issue 27).
3. **No new accounting tables or posting paths** without updating ACCOUNTING_FREEZE.md and this signoff.

---

*End of signoff document.*
