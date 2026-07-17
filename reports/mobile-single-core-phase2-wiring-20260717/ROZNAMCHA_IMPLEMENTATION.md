# ROZNAMCHA_IMPLEMENTATION.md

## Previous loader

Cash mode: `getRoznamcha` (payments + rental_payments merge). Silent catch paths existed historically.

## New unified loader

Cash mode: `loadRoznamcha` → `rpcGetUnifiedCashBankLedger` → `get_unified_cash_bank_ledger`.

## Fallback / error policy

| Condition | Behaviour |
|-----------|-----------|
| Flags off / kill switch | Legacy `getRoznamcha` (expected path, not hard failure) |
| Unified fail | Legacy + amber banner + Retry unified |
| Specific payment account filter | Forced labelled legacy (unified is liquidity set) |
| All-entries mode | Unchanged `getDayBook` |

Does **not** reuse Cash Flow presentation semantics for Roznamcha meaning.
