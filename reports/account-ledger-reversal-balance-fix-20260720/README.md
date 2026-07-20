# Account Ledger reversal balance fix — 2026-07-20

## Problem

Account Ledger (web) with **Include reversals** unchecked hid only the `correction_reversal` row but kept the voided original payment twin. `alignRunningBalances` then recomputed from the visible half-pair, inflating closing balance by Rs. 200,000 (e.g. **4,109,458** instead of **3,909,458**).

Mobile party/account ledgers showed the same inflated closing and a harsh `Bad Gateway · No linked sub-account for legacy fallback` message when party GL RPC failed.

## JE-0323 production diagnosis (read-only)

| Entry | Type | Void | Payment ID | AR-ED1ABD line |
|-------|------|------|------------|----------------|
| RCV-0326 | manual_receipt | yes | 88bc71bb-… | Cr 200,000 |
| JE-0323 | correction_reversal | no | 88bc71bb-… | Dr 200,000 |

Both legs exist on production; net GL movement on the party sub-account is **zero**. Root cause is **presentation filtering**, not missing posting.

## Fix

### Web (`AccountLedgerReportPage`)

- Audit + Include reversals **OFF**: hide `correction_reversal` rows **and** their payment twins (`hasReversalTwin` / `hasOriginalTwin`).
- Audit + Include reversals **ON** (full audit set): preserve RPC `running_balance`; skip destructive realign.
- Extracted helpers: `src/app/lib/accountLedgerPresentation.ts` + unit tests.

### Mobile

- `ledgerEffectiveNet.ts`: effective-net line filter + closing recompute (matches web Include reversals OFF).
- `PartyLedgerReport`: party list uses `get_contact_party_gl_balances` slice; softened load error copy; detail closing from effective-net lines.
- `AccountLedgerReport`: detail closing from effective-net lines.

## Expected result (HASSAN MARDAN / JE-0323 class)

| View | Closing |
|------|---------|
| Web — reversals OFF | Rs. 3,909,458 |
| Web — reversals ON (both legs visible) | Rs. 3,909,458 |
| Mobile party/account detail | Rs. 3,909,458 |

## Validation

- `src/app/lib/accountLedgerPresentation.test.ts` — PASS
- `erp-mobile-app/src/lib/ledgerEffectiveNet.test.ts` — PASS
- `npm run build` — PASS

## Non-goals (unchanged)

- No GL / journal mutation
- No new migration
- No Contacts RPC contract changes
