# LEGACY_PATH_INVENTORY — Mobile Single Core

**Production client:** `erp-mobile-app` only.

## Inventory table

| Module | Screen/route | Current loader | Source of truth | Canonical Single Core | R/W | Company | Branch | Role | Cache/offline | Risk | Required change | Tests | Status |
|--------|--------------|----------------|-----------------|----------------------|-----|---------|--------|------|---------------|------|-----------------|-------|--------|
| Account Ledger | `account-ledger` / AccountLedgerReport | Party AR/AP RPC → unified account → `getAccountLedgerLines` | Mixed | `get_unified_account_ledger` | R | yes | yes | full acct | list journal overlay; no ledger cache | High — empty party RPC used to short-circuit; WIP empty-success fallback | Prefer unified when flags ON; keep leaf JE fallback visible with notice | none | WIP local |
| Party Ledger C/S | `customer-ledger` / `supplier-ledger` | `get_customer_ar_*` / `get_supplier_ap_*` → sub-account JE | Party GL RPC | `get_unified_party_ledger` (**exists, not wired**) | R | yes | yes | full | list uses party GL balances | High | Wire `rpcGetUnifiedPartyLedger` behind flags; remove silent empty→legacy without notice | none | Gap |
| Worker Ledger | `worker-ledger` | operational `worker_ledger_entries` → JE 2010/1180 | Ops + JE | unified party worker basis | R | yes | yes | full | none | Medium | Align with web worker party loader | none | Gap |
| Ledger V2 | `ledger-v2` | unified account else JE | flags | `get_unified_account_ledger` | R | yes | yes | full | none | Medium — unified error flips badge only | Ensure legacy fetch on error or hard-fail | none | Partial |
| Trial Balance | TrialBalanceReport | unified-only (`legacyAvailable: false`) | `get_unified_trial_balance` | same | R | yes | as-of | full | none | Low if flags ON; blocked message if OFF | Keep unified-only | none | Aligned when flags ON |
| Balance Sheet | BalanceSheetReport | TB→BS map | unified TB + accounts | same | R | yes | as-of | full | none | Low; hard-codes 1100/2000 rollup | Parity check vs web | none | Partial |
| P&L | ProfitLossReport | unified TB window | unified | same | R | yes | range | full | none | Low | Parity check | none | Partial |
| Cash Flow | CashFlowReport | unified cash/bank else silent roznamcha | mixed | `get_unified_cash_bank_ledger` | R | yes | range | full | none | Medium silent degrade | Fail loud or explicit legacy banner | none | Gap |
| Day Book / Roznamcha | DayBookReport | **legacy only** payments+JE merge | payments / rental_payments / JE | `get_unified_cash_bank_ledger` (flags exist, **not wired**) | R | yes | yes | full | none | **Highest report gap** | Wire loader flags like web Phase 2.14 | none | Gap |
| Aging | AgingReport | sales/purchases `due_amount` | operational docs | no mobile unified aging | R | yes | yes | full | none | High vs GL | Document as operational OR add GL aging | none | Gap |
| Account Summary | AccountSummaryReport | per-account JE lines | JE | unified account | R | yes | range | full | none | Medium | Prefer unified | none | Gap |
| Dashboard | dashboardMetrics / financialDashboard | RPCs + balance summary fallback | RPC | keep RPC; AR/AP from party GL summary | R | yes | yes | role | listCache elsewhere | Medium silent fallback | Surface RPC errors | none | Partial |
| Contact list balances | getContacts | `get_contact_party_gl_balances` → ops → opening_balance | GL preferred | same GL RPC | R | yes | yes | — | listCache | Medium degrade chain | Never invent zero from miss without label | none | Partial |
| Sales write | POS/Sales modules | `record_sale_with_accounting` etc. | RPC | shared web RPC | W | yes | yes | role | offline draft queue | Medium offline replay | Idempotency / no client JE | sparse | Partial |
| Purchase write | PurchaseModule | `record_purchase_with_accounting` | RPC | shared | W | yes | yes | role | offline draft | Medium | Same | sparse | Partial |
| Payments | accounts/sales | `record_payment_with_accounting` | RPC | shared | W | yes | yes | role | none | Low if RPC-only | Guard double-tap | none | Partial |
| Expense | ExpenseModule | `create_expense_document` | RPC | shared | W | yes | yes | role | listCache | Medium post-RPC patches | Align with web | none | Partial |
| Sale/Purchase edit JE helpers | saleEditAccounting / purchaseEditAccounting | client JE patch + hard-codes 1100/2000 | client | must match web | W | yes | — | admin? | none | High | Audit vs web; no expand | none | Gap |

## Empty-as-zero / silent legacy (must not hide GL problems)

1. `isPartyGlLedgerEmptySuccess` → sub-account JE fallback (**notice required**; WIP adds notice)
2. `unifiedLedgerRpc` returns zeros + error when engine off — callers must check `error`
3. Cash flow unified catch → silent roznamcha
4. `reportLoaderSource` exception → legacy
5. AccountLedger catch → opening 0 / lines [] without notice
6. `getAccountLedgerLines` opening `.limit(5000)` truncation risk
7. Dashboard RPC fail → silent fallback metrics
8. Contacts balance: GL → ops → `opening_balance`
9. Aging: never GL

## Hard-coded codes (sample)

4000/4100 sales revenue; 1100 AR; 2000 AP; 2010/1180 worker; see `defaultAccounts.ts`, `saleEditAccounting.ts`, `workerPartyGlLedger.ts`, `unifiedReportMappers.ts`.

## Flutter / POS

Out of production scope for this alignment. Do not dual-implement Single Core there until Capacitor parity is signed off.
