# Affected golden fixture diff — monitoring fixture update only

**Classification:** monitoring fixture update only (no production data mutation)

## Files changed

| File | Change |
|------|--------|
| `scripts/single-core-ledger/monitoring-company-profiles.json` | DIN CHINA `golden` block only |
| `reports/single-core-ledger/din-china/golden-fixtures.json` | DIN CHINA fixtures + metadata |
| `src/app/lib/unifiedLedgerGoldenFixtures.ts` | `MR_JALIL_EXPECTED_BALANCE` |
| `src/app/lib/unifiedLedgerGoldenFixtures.test.ts` | constant assertion |
| `scripts/single-core-ledger/unifiedLedgerBrowserQaHelpers.mjs` | `MR_JALIL_GOLDEN` |
| `scripts/single-core-ledger/unifiedLedgerBrowserQaHelpers.test.mjs` | tolerance test values |
| `scripts/single-core-ledger/loadMonitoringProfile.test.mjs` | profile load assertion |

## Assertions changed (DIN CHINA only)

| Field | Before | After | Evidence |
|-------|--------|-------|----------|
| `mr_jalil_closing_pkr` | 216,299 | **116,299** | RCV-0317 −100k + JE-0003 −1 |
| `trial_balance_debit_credit_pkr` | 358,213,589.15 | **382,219,344.15** | Jul 11 GL batch |
| `roznamcha_cash_in_pkr` | 60,042,230 | **61,022,230** | Jul 11 GL batch |
| `roznamcha_cash_out_pkr` | 39,795,518 | **62,619,613** | Jul 11 GL batch |
| `roznamcha_closing_pkr` | 20,246,712 | **−1,597,383** | In − Out (verified) |

## Unchanged

- DIN BRIDAL golden values
- DIN COUTURE golden values
- Tolerance / assertion loosening: **none**
- Phase 2.16 checks: **not disabled**
- `partyDiscountLegacyLedgerMatch.test.ts` — retains 216299 mock scenario (JE-0003 math unit test)

## Comment / evidence reference

See `je-0028-read-only-tieout.md` — MR JALIL driven by RCV-0317; JE-0028 adds Rs. 2 TB only.
