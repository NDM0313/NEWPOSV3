/**
 * Account / GL statement branch scope for mobile ledgers.
 * Matches web `STATEMENT_ALL_BRANCHES_SCOPE` in
 * `src/app/services/accountStatementUnifiedMainService.ts`.
 *
 * Company-wide account ledgers must not filter by app session branch:
 * openings often live on null-branch JEs while movements post on other/null
 * branches — scoping to app branch yields false "Opening balance only" UIs.
 *
 * Pass this into ledger loaders; keep session `branchId` only for DateRangeBar FY resolution.
 */
export const ACCOUNT_LEDGER_ALL_BRANCHES: null = null;
