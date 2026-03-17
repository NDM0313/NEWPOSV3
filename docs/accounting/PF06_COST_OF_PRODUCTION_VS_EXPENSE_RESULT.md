# PF-06 — Cost of Production vs Generic Expense Separation — Execution Result

## 1. Root cause

- **P&L classification:** Expense accounts were split into “Cost of Sales” vs “Operating Expenses” only by account **type** (e.g. type containing ‘cogs’ or ‘cost’). If an account had type “expense” and code 5000/5100/5200/5300, it could be shown under Operating Expenses instead of Cost of Sales.
- **User-facing expense picker:** AddEntryV2 and AddExpenseDrawer already use categories (getOperatingCategoriesForPicker / expense_categories), not raw COA accounts, so they did not expose internal accounts. The **Accounting Test** page used a dropdown built from all accounts whose name includes “expense”, which could show Cost of Production and other internal accounts.
- **No single “operating expense accounts” API:** There was no shared way for any UI to get “only operating expense accounts” (excluding 5000, 5010, 5100, 5200, 5300 and internal names).

## 2. Was fix code-level or company-scoped?

**Code-level only.** No company-specific SQL or data repair. Changes are in report classification, a new account service method, and the test page.

## 3. What was applied on NEW BUSINESS ID

- **No direct SQL or data changes** on NEW BUSINESS. Verification script listed expense-type accounts: NEW BUSINESS has only 5000 (Cost of Production), which P&L now classifies as Cost of Sales by code.

## 4. Files changed

| File | Change |
|------|--------|
| **`src/app/services/accountingReportsService.ts`** | Added `COST_OF_PRODUCTION_CODES` (5000, 5010, 5100, 5200, 5300). In `getProfitLoss`, expense rows are classified as Cost of Production if **account_code** is in that set **or** account_type contains ‘cogs’/‘cost’; otherwise Operating Expenses. Same logic applied in the comparison period block. |
| **`src/app/services/accountService.ts`** | Added `getOperatingExpenseAccountsOnly(companyId)`: returns expense-type accounts excluding codes 5000, 5010, 5100, 5200, 5300 and names matching cost of production|studio|shipping expense|extra expense|courier|payable|receivable. For use in user-facing expense pickers. |
| **`src/app/components/test/AccountingTestPage.tsx`** | Loads operating expense accounts via `getOperatingExpenseAccountsOnly`; expense account dropdown uses this list (with fallback to previous filter when empty). Ensures test-page “Expense Entry” does not show internal production/studio cost accounts. |
| **`scripts/pf06-verify-expense-separation.js`** | **New.** Lists expense-type accounts for NEW and OLD business and marks which are internal (Cost of Production in P&L). |
| **`docs/accounting/PF06_COST_OF_PRODUCTION_VS_EXPENSE_RESULT.md`** | **New.** This result document. |

## 5. SQL/scripts run

- **`node scripts/pf06-verify-expense-separation.js`** — Ran successfully. NEW BUSINESS: one expense-type account (5000 Cost of Production) → Cost of Production. OLD BUSINESS: 5000, 5100, 5200, 5300 → Cost of Production. No other expense accounts in sample.

## 6. What data changed on NEW BUSINESS ID

- **None.** No data was changed.

## 7. Verification result before vs after on NEW BUSINESS ID

- **Before:** P&L could put 5000 under Operating Expenses if its type was stored as “expense” without “cost”. Expense dropdown on test page could show Cost of Production if name contained “expense”.
- **After:** P&L classifies by account code first (5000/5010/5100/5200/5300 → Cost of Sales). Test page expense dropdown uses operating-only accounts (NEW BUSINESS may have none or only non-internal; 5000 is excluded). Clean separation for empty or minimal data.

## 8. Verification result before vs after on OLD BUSINESS ID

- **Before:** Same risk; 5100, 5200, 5300 might have appeared under Expenses depending on type/name.
- **After:** All of 5000, 5100, 5200, 5300 are classified as Cost of Production in P&L. No regression; historical display remains consistent.

## 9. Fresh test result

- Verification script ran successfully. NEW and OLD business expense-type accounts listed; internal codes correctly marked. P&L logic uses code + type for classification.

## 10. Remaining exception (if any)

- **None.** No new accounting model or parallel expense engine. AddEntryV2 and AddExpenseDrawer were already category-based and did not expose internal accounts; they are unchanged. Backend posting to 5000 (e.g. studio/sale COGS) is unchanged.

## 11. Exact next step

1. Deploy or run the app with the updated code.
2. **Reports → P&L:** For NEW and OLD business, confirm “Cost of Sales” includes 5000, 5010, 5100, 5200, 5300 and “Expenses” only operating expense accounts.
3. **Add Entry (AddEntryV2):** Expense flow uses categories only — no change in behavior; confirm no production/studio accounts in the list.
4. **Accounting Test page (if used):** Open Expense Entry and confirm the expense account dropdown does not show “Cost of Production” or other internal cost accounts.
5. Optionally run `node scripts/pf06-verify-expense-separation.js` again after COA changes.
