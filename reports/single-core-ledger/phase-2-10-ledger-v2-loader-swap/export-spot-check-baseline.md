# Phase 2.10B — Export spot-check (baseline, signed)

**Status:** **SIGNED** — not waived  
**Timestamp (UTC):** 2026-06-26  
**Entity:** MR JALIL (customer)  
**Main loader:** legacy (`data-ledger-v2-main-loader="legacy"`)

## On-screen authority

| Field | Value | Pass |
|-------|-------|------|
| Closing balance (summary card) | PKR 216,300 | PASS |
| Main loader | legacy | PASS |

Exports derive from the same `result.rows` / `summary` as the on-screen table (`LedgerStatementCenterV2Page` → `buildExportData`).

## Artifacts

| Format | File | Closing 216,300 |
|--------|------|-----------------|
| PDF (print snapshot `.sr-only`) | `screenshots/210-export-pdf-preview.png` | PASS |
| Excel | `screenshots/210-export-ledger.xlsx` | PASS |
| CSV | `screenshots/210-export-ledger.csv` | PASS |

## Verification method

Automated via `run-phase-210-loader-browser-qa.mjs baseline`:

- PDF: `.sr-only` print preview text contains `216,300`
- Excel/CSV: downloaded files contain `216300` / `216,300`
- On-screen closing matches export totals

## Gate for candidate mode

Export spot-check **signed** for baseline. Candidate loader-flag QA may proceed after ops approval to run `phase-210-enable-loader-ledger-v2.sql` in preview/staging only.
