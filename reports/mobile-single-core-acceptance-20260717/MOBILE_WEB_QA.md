# MOBILE_WEB_QA.md

Generated: 2026-07-17T12:23:41.022Z

Same React bundle as APK via `http://127.0.0.1:5175/` (worktree `feature/mobile-single-core-finalization`).

**Role:** DIN CHINA admin (`din@yahoo.com`) · Main Branch · read-only navigation

**Summary:** **9 PASS / 0 FAIL** (Worker Ledger empty list = expected for DIN CHINA)

| Step | Result | Note |
|---|---|---|
| pin_skip | PASS | Skipped device PIN setup |
| Customer Ledger | PASS | Customer list with GL balances (Rs. / Receivable) |
| Supplier Ledger | PASS | Supplier list loads |
| Worker Ledger | **PASS (EXPECTED_EMPTY)** | "No workers found" — DIN CHINA has 0 workers rows (parity matrix) |
| Account Ledger | PASS | Account picker loads |
| Day Book / Roznamcha | PASS | Report shell loads |
| Cash Flow | PASS | Report shell loads |
| Trial Balance | PASS | Report shell loads |
| Ledger V2 | PASS | Report shell loads |

Screenshots: `mobile-web-02-post-login.png`, `mobile-web-03-hub.png`, `mobile-web-report-*.png`

Script: `node scripts/mobile-single-core-mobile-web-qa.mjs`
