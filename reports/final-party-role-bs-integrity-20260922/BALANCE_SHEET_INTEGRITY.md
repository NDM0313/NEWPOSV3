# Balance Sheet Integrity

## Screenshot imbalance

Displayed TB/BS gap for cumulative **2016-01-01 → 2026-09-22**: **Rs. -4,897,180.00**

Period **2025-10-01 → 2026-09-22** was already balanced.

## Root cause (NOT unbalanced JEs)

All-time non-void JE matrix through 2026-09-22:

| Metric | Value |
|--------|------:|
| Unbalanced JE count (`ABS(Dr−Cr) > 0.01`) | **0** |
| Sum of JE differences | **0.00** |
| Expected screenshot gap | -4,897,180.00 |

**Does not reconcile to JE imbalance** → reporting scope issue.

### Diagnosis

Legacy `getTrialBalance` filtered `accounts.is_active = true` only.

| Scope | Total Dr | Total Cr | Diff |
|-------|----------|----------|------|
| All accounts (unified / full GL) | 872,788,218.57 | 872,788,218.57 | **0.00** |
| Active accounts only (legacy TB/BS) | 866,592,738.57 | 871,489,918.57 | **-4,897,180.00** |
| Inactive accounts contribution | 6,195,480.00 | 1,298,300.00 | **+4,897,180.00** |

Inactive accounts with lines:

| Code | Name | Net |
|------|------|-----|
| 620104 | SLM WED | 2,102,400 |
| 620103 | SOLOR | 1,677,850 |
| 130105 | SHOP A12 | 826,930 |
| 620004 | ZAKKAT 2024 | 290,000 |
| **Sum** | | **4,897,180** |

Oct 2025→Sep 2026 has **zero** inactive-account activity → period TB stays balanced.

## Fix

Code: `accountingReportsService.getTrialBalance` now loads **all** company accounts (active + inactive). Rows still omit zero activity; totals include historical inactive leaves.

**No plug JEs. No sale rebuilds** (none candidates). Manual-review count: **0**.

## After closeout + deploy expectation

| Check | Result |
|-------|--------|
| Cumulative all-account TB diff | **0.00** |
| Legacy-active-only residual (pre-UI fix) | -4,897,180 (explains screenshot) |
| After UI fix | TB/BS `tbImbalance` = **0.00** |
| Oct 2025→Sep 2026 | remains **0.00** |
