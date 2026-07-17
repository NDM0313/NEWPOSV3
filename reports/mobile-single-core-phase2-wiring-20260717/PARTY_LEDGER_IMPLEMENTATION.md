# PARTY_LEDGER_IMPLEMENTATION.md

## Previous loader

Customer/supplier detail used legacy party GL RPCs (`getCustomerPartyGlLedgerLines` / `getSupplierPartyGlLedgerLines` via `partyGlLedger.ts`), with JE sub-account fallback on empty success.

## New unified loader

When flags ON: `loadPartyLedger` → `rpcGetUnifiedPartyLedger` → `get_unified_party_ledger`.

## Fallback / error policy

| Condition | Behaviour |
|-----------|-----------|
| Flags off / kill switch | Legacy party GL path; metadata `legacy` |
| Unified hard fail | Labelled legacy fallback + soft notice; debug `fallbackReason` |
| Empty unified / party GL success | May use sub-account JE fallback with explicit notice (not silent zero owed) |
| Worker kind | Still operational 2010/1180 path (not unified this phase) |

Admin/debug: `LoaderSourceBadge` + `AccountingLoaderDebugBadge`.
