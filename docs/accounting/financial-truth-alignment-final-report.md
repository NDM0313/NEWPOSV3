# Financial Truth Alignment — Final Report

**Date:** 2026-06-11  
**Baseline deployed commit:** `83d947f4` (`fix(accounting): finalize ar ap effective visibility and fix link ux`)  
**Scope:** Frontend + docs + read-only SQL diagnostics only — **no migrations**, **no GL mutations**

## Delivered

### Part A — Three-basis contract

- `src/app/lib/financialTruthBasis.ts` — `ReportBasis`, official/effective/audit rules, difference reason categories
- `docs/accounting/FINANCIAL_TRUTH_BASIS.md` — authoritative screen mapping
- Pointer added in `docs/accounting/BALANCE_SOURCE_POLICY.md`

### Part B — Financial Truth Tie-out

- `src/app/lib/financialTruthTieOut.ts` — pure tie-out math + difference rows
- `src/app/services/financialTruthTieOutService.ts` — TB / BS / P&L / AR / cash aggregation
- `FinancialTraceCenterPage` renamed **Financial Truth Center** with **Tie-out** tab (cards, difference table, drilldowns, regression quick links)

### Part C — Basis banners + Cash Flow GL fix

- `ReportBasisBanner` / `ReportBasisBadge` wired on TB, BS, P&L, party statements, AR/AP center, Ledger V2, COA, Cash Flow
- `getCashFlowStatement` accepts `basis: 'official_gl' | 'effective_party'`; official includes all non-void JEs (incl. `correction_reversal`)

### Part D–F — Diagnostics

Read-only SQL under `scripts/sql/`:

- `diag_trial_balance_tieout.sql`
- `diag_ar_ap_gl_vs_party_effective.sql`
- `diag_customer_balance_tieout.sql`
- `diag_rental_customer_ledger_tieout.sql`

## Regression examples (expected live behavior)

| Case | Effective | Official GL | Tie-out reason |
|------|-----------|-------------|----------------|
| AR-CUS0000 / Walk-in | Rs 0 | Rs 1 (JE-0168 residue) | `cancelled_audit_hidden_from_effective` |
| Inayat / REN-0002 | Ledger Rs 0 | Rental dual-stream | `valid_timing_classification` or deeper trace |
| Saqib / RCV-0008 | Rs 0 | Metadata D3 | `payment_source_mismatch` / metadata review |

No auto-repair applied. JE-0168 and orphan GL corrections unchanged.

## Tests & build

```text
npx tsx --test \
  src/app/lib/financialTruthBasis.test.ts \
  src/app/lib/financialTruthTieOut.test.ts \
  src/app/lib/cashFlowReportLogic.test.ts
# 24 pass, 0 fail

npm run build
# success
```

Extended: `financialTraceClassification.test.ts` (hq-sl-0003 case)

## Stop condition

Tie-out surfaces known audit residues (AR-CUS0000 Rs 1) as **documented differences** — no GL correction or migration applied without explicit approval.

## Deploy

Frontend-only via `deploy/vps-build-erp-only.sh` (see commit hash below after push).
