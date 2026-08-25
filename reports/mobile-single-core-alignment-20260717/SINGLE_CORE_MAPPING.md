# SINGLE_CORE_MAPPING — Mobile vs Web contracts

## Shared RPCs (canonical)

| Contract | Mobile entry | Web entry | Wired on mobile UI? |
|----------|--------------|-----------|---------------------|
| `get_unified_account_ledger` | `rpcGetUnifiedAccountLedger` | unifiedLedgerService | Ledger V2 + Account Ledger (flagged) |
| `get_unified_party_ledger` | `rpcGetUnifiedPartyLedger` | same | **Not wired** to PartyLedgerReport |
| `get_unified_trial_balance` | `rpcGetUnifiedTrialBalance` | same | TB / BS / P&L via `unifiedReports` |
| `get_unified_cash_bank_ledger` | `rpcGetUnifiedCashBankLedger` | same | Cash Flow flagged; Roznamcha **not** |
| `get_customer_ar_gl_ledger_for_contact` | `partyGlLedger.ts` | accountingService | Party + Account linked AR |
| `get_supplier_ap_gl_ledger_for_contact` | `partyGlLedger.ts` | accountingService | Party + Account linked AP |
| `get_contact_party_gl_balances` | `contactBalancesRpc.ts` | same | Contact/party lists |
| Write RPCs (`record_*_with_accounting`, cancels, returns) | `sales.ts` / `purchases.ts` / `accounts.ts` / `expenses.ts` | same names | Yes — primary writes |

## Basis mapping (target for debug indicator)

| Basis | Meaning | Mobile today |
|-------|---------|--------------|
| Official Posted GL | Non-void JE / official_gl | Unified loaders use `official_gl` |
| Effective party | Collapsed adjustments | Not exposed on Capacitor party screens |
| Audit full history | Include adjustments/reversals | Not first-class on mobile |
| Operational due | sales/purchases due_amount | Aging, some dashboard |

**Required (Phase 3):** non-intrusive admin/debug badge showing basis + loader source (`legacy` \| `unified`) — partial via `LoaderSourceBadge` on some screens only.

## Balance identity rule

Dashboard customer due, party list, party statement closing, and receipt “balance due” must share one documented contract (party GL vs operational). Today they mix GL RPC, operational summary, and document due — **must converge** in Phase 2 adapter layer.

## Adapter layer (Phase 2 target — not fully built)

Centralize in one module (proposed path: `erp-mobile-app/src/api/singleCore/`):

- `resolveScope({ companyId, branchId, asOf, basis })`
- `loadPartyStatement` / `loadAccountLedger` / `loadTrialBalance` / `loadRoznamcha`
- Map unified rows ↔ existing `LedgerLine` without sign invention
- Forbid treating missing RPC as `0` without `error`

**Status:** Flag keys + `unifiedLedgerRpc` + `unifiedReports` exist; **Party Ledger and Roznamcha are the largest wiring gaps.**
