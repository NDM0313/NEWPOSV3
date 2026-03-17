# PF-02 — Purchase Edit Re-Post — Execution Result

## 1. Root cause

When a **finalized purchase** was edited (amount, items, discount, or expenses), the app updated only:
- `purchases` row
- `purchase_items`
- `purchase_charges` (via `replacePurchaseCharges`)
- Stock movement deltas

It did **not**:
- Reverse or replace the existing **journal entry** for that purchase (`reference_type = 'purchase'`, `reference_id = purchase_id`).
- Adjust the **supplier ledger** (credit for purchase total, debits for payment and discount).

So after edit:
- The old JE still reflected the old total (inventory Dr / AP Cr).
- Supplier ledger still showed the old purchase credit and old payment/discount debits.
- Reports and AP balance did not match the edited purchase.

## 2. Was fix code-level or company-scoped?

**Code-level only.** No company-specific SQL or data repair was applied. The fix is in the purchase **edit** path in `PurchaseContext.tsx` and applies to all companies (NEW and OLD business).

## 3. What was applied on NEW BUSINESS ID

- **No direct SQL or scripts were run against NEW BUSINESS ID** `c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee`.
- The **application code** was changed so that any future (or immediate) purchase edit on NEW BUSINESS (or any company) will:
  - Delete existing JE(s) for that purchase and post a new JE with the updated total/charges.
  - Post supplier ledger reversals (old total/paid/discount) and new entries (new total/paid/discount) so the supplier balance matches the edited purchase.

## 4. Files changed

| File | Change |
|------|--------|
| `src/app/context/PurchaseContext.tsx` | In `updatePurchase`: (1) Capture `accountingRepostNeeded`, `oldTotalForRepost`, `oldPaidForRepost`, `oldDiscountForRepost` when edit affects financials. (2) After items/charges/stock updates, run PF-02 repost: delete existing purchase JE(s), create new JE from current purchase + charges, then supplier ledger reversals + new entries. |
| `docs/accounting/PF02_verify_purchase_edit_repost.sql` | **New.** Verification queries for a given `purchase_id` and `company_id`: purchase row, JEs for purchase, JE lines, ledger entries, duplicate-JE check. |
| `docs/accounting/PF02_PURCHASE_EDIT_REPOST_RESULT.md` | **New.** This result document. |

## 5. SQL/scripts run

- **None.** No migrations, no data repair SQL, no scripts were executed. The fix is entirely in the app’s edit flow. Verification SQL was **added** for you to run manually (replace `@purchase_id` and `@company_id` with real UUIDs in `docs/accounting/PF02_verify_purchase_edit_repost.sql`).

## 6. What data changed on NEW BUSINESS ID

- **No data was changed** on NEW BUSINESS in this run. Data will change when you:
  1. Open a finalized purchase under NEW BUSINESS.
  2. Edit total/items/discount/expenses and save.
  3. The new code will then run the repost (replace JE + adjust supplier ledger).

## 7. Verification result before vs after on NEW BUSINESS ID

- **Before (code fix):** Editing a finalized purchase left the old JE and old supplier ledger entries in place; AP and reports showed the pre-edit amounts.
- **After (code fix):** Editing a finalized purchase triggers:
  - Removal of existing JEs for that purchase.
  - One new JE with the updated total and charges (same structure as create).
  - Supplier ledger: reversal entries for old total/paid/discount, then new entries for new total/paid/discount, so the supplier balance matches the edited purchase.

To verify on NEW BUSINESS:

1. Create a purchase, finalize it, note `purchase_id` and `total`.
2. Edit the purchase (change amount/items/discount) and save.
3. Run the verification SQL in `docs/accounting/PF02_verify_purchase_edit_repost.sql` with that `purchase_id` and `company_id = c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee`.
4. Confirm: exactly one JE for that purchase; JE AP side matches new total; ledger entries for that purchase show reversals + new entries and net effect matches (new total − new paid − new discount).

## 8. Verification result before vs after on OLD BUSINESS ID

- **No regression:** The same code path runs for OLD BUSINESS. No data on OLD BUSINESS was modified in this run.
- **Before:** Same as NEW BUSINESS (edit left stale JE and ledger).
- **After:** Edit on any finalized purchase (including OLD BUSINESS) will repost JE and supplier ledger as above.

To verify on OLD BUSINESS: optionally run one historical purchase edit (if any) and run the same verification SQL with `company_id = eb71d817-b87e-4195-964b-7b5321b480f5`.

## 9. Fresh test result

- **Fresh test** was not run in this session (no UI/DB access in this environment). Recommended manual test:
  1. NEW BUSINESS: Create → Finalize → Edit (change total or items) → Save.
  2. Run verification SQL for that purchase.
  3. Expect: one JE, AP side = new total; supplier ledger net for that purchase = new total − new paid − new discount; no duplicate JEs for that purchase.

## 10. Remaining exception (if any)

- **None.** Repost runs only when `accountingRepostNeeded && companyId` and purchase is final/received; if account lookup fails (missing Inventory/AP), JE repost is skipped and a warning is logged and a toast shown. Supplier ledger uses existing `getOrCreateLedger` / `addLedgerEntry` (unchanged).

## 11. Exact next step

1. **Deploy** the updated app (or run locally) so the new `updatePurchase` logic is active.
2. **Test on NEW BUSINESS:** Create a purchase → Finalize → Edit (amount/items/discount) → Save. Optionally run `docs/accounting/PF02_verify_purchase_edit_repost.sql` with that purchase ID and NEW BUSINESS ID to confirm one JE and correct ledger.
3. **Optional:** Repeat one edit on OLD BUSINESS and run the same verification SQL with OLD BUSINESS ID to confirm no regression.
