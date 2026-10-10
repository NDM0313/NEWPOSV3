# Finance next review instructions — Phase 3B-F

## After operator deploys Phase 3B-F preview export UI

1. Open Cash Flow report for **DIN CHINA** and **DIN BRIDAL** with preview enabled (authorized role).
2. Click **Export row-keyed JSON** for each company (same date range as Phase 3B-D golden capture).
3. Run locally:
   ```bash
   node scripts/single-core-ledger/phase-3b-f/export-cash-flow-row-diff.mjs \
     --input <exported-json> \
     --output reports/single-core-ledger/phase-3b-f-cash-flow-row-export/
   ```
4. Review diff buckets:
   - **transfer-leg** — DIN CHINA internal transfer treatment
   - **opening-balance** — DIN BRIDAL `opening_balance_account` rows
   - **source-module**, **account-scope**, **party-mapping** as needed
5. Answer finance rule confirmation questions in `phase-3b-e-cash-flow-delta-investigation/finance-rule-confirmation-pack.md`.

## Still blocked until finance approval

- Cash Flow unified loader swap
- Any behavior change to legacy or preview totals
- R7 / R8 / next company

## Unchanged

- BS/P&L finance status: **PENDING**
- Official Cash Flow: **legacy roznamcha path**
