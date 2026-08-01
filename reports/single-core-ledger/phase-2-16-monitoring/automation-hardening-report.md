# Phase 2.16 — Automation hardening report

**Date:** 2026-06-27  
**Scope:** Playwright QA helpers and monitoring script only — no production logic, flags, or GL changes.

---

## Known flakes (Phase 2.15X)

| Flake | Symptom | Root cause |
|-------|---------|------------|
| Ledger V2 MR JALIL | Playwright closing = `NaN` | Body-wide regex missed LV2 stat card label `Closing balance` (lowercase) |
| Admin Compare Pilot Batch | Sometimes `pass=3` instead of `9` | DOM read before Compared/Pass stat cards settled |

---

## Fixes applied

### Shared helpers — `scripts/single-core-ledger/unifiedLedgerBrowserQaHelpers.mjs`

- `readStatCardValue` — scoped to `.rounded-lg.border` stat cards (avoids body regex false positives)
- `readLedgerV2MrJalilClosing` — waits for `Closing balance` label, reads stat card first
- `waitForPilotBatchStats` — waits until Compared **and** Pass reach target before read
- `readPilotBatchSummary` — reads Compared/Pass/Fail from stat cards, not body regex
- `waitForTrialBalanceTotals` / `readTrialBalanceTotals` — footer totals wait + parse
- `readVisibleMainLoaderAttr` — reads **last** visible loader marker (avoids stale loading shell)

### Parser tests — `scripts/single-core-ledger/unifiedLedgerBrowserQaHelpers.test.mjs`

- `parsePkr` comma/negative/empty cases
- MR JALIL / Roznamcha / TB golden constants
- Trial Balance footer regex with bullet-prefixed totals

### Monitoring script — `scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs`

- Screen order aligned with Phase 2.12X closeout (TB before PL/LV2)
- Production flags via PowerShell `Get-Content | ssh` pipe (Windows-safe)
- Roznamcha preview toggle enabled before reading `legacy_shadow` compare source
- Screenshot on LV2 parse failure and Admin Compare mismatch (not triggered on final run)

---

## Verification results

| Check | Before (2.15X) | After (2.16) |
|-------|----------------|--------------|
| Ledger V2 MR JALIL automation | NaN (flake) | **216,300 PASS** |
| Admin Compare Pilot Batch | pass=3 (timing flake) | **9/9 PASS** |
| Trial Balance loader + totals | Script navigation flake | **unified + 407,957,271.02 PASS** |
| Production flags SSH | bash syntax error | **12/12 ON, 0 other companies PASS** |

### Repo gates

- `npm run test:unified-ledger` — **240 PASS** (includes new helper tests)
- `npm run build` — **PASS**

---

## Status

**Automation flakes resolved.** No waivers required for Phase 2.16 final verification.
