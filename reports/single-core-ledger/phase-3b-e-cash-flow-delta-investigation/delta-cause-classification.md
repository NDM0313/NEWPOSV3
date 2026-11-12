# Delta cause classification — Phase 3B-E

**Row matching note:** Legacy DOM rows use roznamcha references; preview RPC uses journal line IDs. Pairwise join returned 0 matches — **bucket analysis** by source module / reference type used instead.

## DIN CHINA (large delta)

| Classification | Impact | Notes |
|----------------|--------|-------|
| SOURCE_MODULE_MAPPING_DIFFERENCE | Cash Out +58.9M on transfers in preview | Legacy Transfers: 89 rows, **out=0**; Preview `transfer`: 169 rows, out=58.9M |
| PARTY_EFFECTIVE_MAPPING_DIFFERENCE | ~PKR 9M+ receipt classification | manual_receipt +13M in preview; sales vs payment bucket split |
| CASH_BANK_ACCOUNT_SCOPE_DIFFERENCE | 82 extra preview rows | 14 liquidity accounts in RPC |

**Primary explanation:** Preview counts **both legs** of internal transfers as cash movement; legacy roznamcha stream presents transfers predominantly as **cash-in** in the Transfers module without matching out legs in that bucket.

## DIN BRIDAL (small delta)

| Classification | Impact | Notes |
|----------------|--------|-------|
| OPENING_BALANCE_RULE_DIFFERENCE | +PKR 912,850 in | 2 `opening_balance_account` rows in preview only |
| LEGACY_INCLUDES_PREVIEW_EXCLUDES | general/journal split | Manual JE legacy vs general out PKR 704,500 preview |

**Primary explanation:** Opening balance account lines and manual/general JE mapping differences — net closing Δ PKR 55,000.

## DIN COUTURE

Zero-diff at summary level — no causes classified.

## Follow-up

`UNKNOWN_NEEDS_EXPORT_DETAIL` — add journal-line-keyed row export to preview panel before finance sign-off on non-zero companies.
