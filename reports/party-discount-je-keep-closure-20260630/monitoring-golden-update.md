# Monitoring golden update — MR JALIL

**Generated:** 2026-06-30

| Field | Old | New |
|-------|-----|-----|
| MR JALIL expected closing (DIN CHINA) | **PKR 216,300** | **PKR 216,299** |

**Reason:** Operator **KEEP** decision for approved PKR 1 `party_discount` QA entry **JE-0003**.

## Files changed

1. `scripts/single-core-ledger/monitoring-company-profiles.json` — `profiles.din-china.golden.mr_jalil_closing_pkr`
2. `reports/single-core-ledger/din-china/golden-fixtures.json` — all MR JALIL closing fixture fields
3. `src/app/lib/unifiedLedgerGoldenFixtures.ts` — `MR_JALIL_EXPECTED_BALANCE` (Admin Compare 9/9 pilot batch)
4. `scripts/single-core-ledger/unifiedLedgerBrowserQaHelpers.mjs` — `MR_JALIL_GOLDEN` (browser QA helper aligned)

## Unchanged

- DIN BRIDAL / DIN COUTURE goldens
- Loader flags and database GL data
- JE-0003 (not reversed)
