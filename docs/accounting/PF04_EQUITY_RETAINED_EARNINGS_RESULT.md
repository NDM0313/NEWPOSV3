# PF-04 — Equity / Retained Earnings — Execution Result

## 1. Root cause

- **Missing equity accounts:** Default account creation (`ensure_erp_accounts`, RPC fallbacks, and the NEW BUSINESS create script) did not create equity accounts. Companies could have no accounts with type `equity`, so the Balance Sheet equity section showed only the derived "Retained Earnings / Net Income" line (net income to date) with no Owner Capital or Retained Earnings account for opening capital or structural clarity.
- **Presentation:** The derived line was labeled "Retained Earnings / Net Income"; it represents accumulated P&L (revenue − expense) to date with no period closing in the frozen model. Grouping in the UI did not put this line under a "Retained Earnings" subgroup when the label did not contain "earnings" or "profit".

## 2. Was fix code-level or company-scoped?

- **Code-level:** Equity accounts 3000 (Owner Capital) and 3002 (Retained Earnings) were added to `ensure_erp_accounts` and to the RPC fallbacks in `accounting_ensure_erp_accounts_rpc.sql`. Balance Sheet report label was changed to "Net Income (to date)" and grouping was updated so it appears under Retained Earnings.
- **Company-scoped (one-time backfill):** A backfill script and SQL were run to ensure NEW BUSINESS and OLD BUSINESS have 3000 and 3002. No other company-specific logic.

## 3. What was applied on NEW BUSINESS ID

- **Backfill:** Ran `scripts/pf04-equity-backfill.js`, which inserted accounts 3000 (Owner Capital) and 3002 (Retained Earnings) for company `c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee` when missing (ON CONFLICT DO NOTHING). Both accounts now exist with type `equity`, balance 0.

## 4. Files changed

| File | Change |
|------|--------|
| **`migrations/accounting_ensure_default_accounts.sql`** | In `ensure_erp_accounts`: added INSERTs for 3000 (Owner Capital) and 3002 (Retained Earnings), type `equity`. |
| **`migrations/accounting_ensure_erp_accounts_rpc.sql`** | In `ensure_erp_accounts_for_current_company` and `ensure_erp_accounts_all_companies` fallback blocks: added INSERTs for 3000 and 3002. |
| **`src/app/services/accountingReportsService.ts`** | Balance Sheet: comment clarified; derived equity line label changed from "Retained Earnings / Net Income" to "Net Income (to date)". |
| **`src/app/components/reports/BalanceSheetPage.tsx`** | `groupEquity`: added `n.includes('net income')` so "Net Income (to date)" is grouped under Retained Earnings. |
| **`docs/accounting/PF04_equity_backfill_new_old_business.sql`** | **New.** One-time SQL to backfill 3000/3002 for NEW and OLD business. |
| **`scripts/pf04-equity-backfill.js`** | **New.** Node script to run the same backfill and list resulting accounts. |
| **`docs/accounting/PF04_EQUITY_RETAINED_EARNINGS_RESULT.md`** | **New.** This result document. |

## 5. SQL/scripts run

- **`node scripts/pf04-equity-backfill.js`** — Ran successfully. Inserted 3000 and 3002 for NEW BUSINESS and OLD BUSINESS (idempotent). Verified: both companies have the four rows (3000, 3002 each).
- **`node scripts/verify-balance-sheet-new-business.js`** — Ran after backfill. NEW BUSINESS now lists 3000 and 3002 in "All accounts and category" as equity; Balance Sheet equation remains correct (zero activity so far).

## 6. What data changed on NEW BUSINESS ID

- **accounts:** Two new rows (if they did not exist): code 3000 (Owner Capital, type equity), code 3002 (Retained Earnings, type equity). No other tables changed.

## 7. Verification result before vs after on NEW BUSINESS ID

- **Before:** NEW BUSINESS had no equity accounts (only 1000, 1010, 1020, 1100, 1200, 2000, 2010, 2030, 4000, 5000). Balance Sheet equity section showed only the derived net income line (0 if no activity).
- **After:** NEW BUSINESS has 3000 (Owner Capital) and 3002 (Retained Earnings). Balance Sheet will show Owner Capital (0), Retained Earnings (0), and Net Income (to date) when non-zero, grouped under Owner Capital / Retained Earnings. Structure is correct and consistent.

## 8. Verification result before vs after on OLD BUSINESS ID

- **Before:** OLD BUSINESS already had 3000 and 3002 in the DB (from earlier seed or migration); one had type `Equity` (capital E). Balance Sheet already showed equity accounts when present.
- **After:** Backfill ran ON CONFLICT DO NOTHING so existing rows unchanged. Both 3000 and 3002 exist. No regression; Balance Sheet equity section remains consistent. Type normalization (equity vs Equity) is handled by `accountTypeCategory` in the app (case-insensitive).

## 9. Fresh test result

- **Backfill:** Ran successfully; both companies have 3000 and 3002.
- **Balance Sheet verify script:** Ran for NEW BUSINESS; equity accounts listed; equation holds (all zeros).

## 10. Remaining exception (if any)

- **None.** No new accounting model or parallel equity engine. Opening capital can be posted to 3000 via manual JE or future feature. Retained Earnings (3002) is available for future use; in the frozen model, "Net Income (to date)" is derived from P&L and not closed to 3002.

## 11. Exact next step

1. **Deploy** migration changes so new companies and `ensure_erp_accounts_all_companies` get 3000/3002.
2. For any other company missing equity accounts, run `node scripts/pf04-equity-backfill.js` (after adding that company ID to the script) or run `docs/accounting/PF04_equity_backfill_new_old_business.sql` in Supabase with that company’s ID.
3. In the app, open **Reports → Balance Sheet** for NEW BUSINESS and OLD BUSINESS and confirm the equity section shows Owner Capital, Retained Earnings, and (when applicable) Net Income (to date).
