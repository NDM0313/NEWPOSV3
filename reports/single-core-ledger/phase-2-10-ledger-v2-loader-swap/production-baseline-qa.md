# Phase 2.10E — Production baseline QA (loader OFF)

**Status:** **PENDING — not executed** (production frontend not deployed)  
**Prerequisite:** Production deploy of `phase-210c-fix` bundle with `unified_ledger_loader_ledger_v2 = false`

## Execute after deploy approval

```powershell
$env:QA_BROWSER_BASE_URL = 'https://erp.dincouture.pk'
$env:QA_BROWSER_PASSWORD = '<admin password>'
node scripts/single-core-ledger/run-phase-210-loader-browser-qa.mjs baseline
```

## Expected results

| Check | Expected |
|-------|----------|
| `data-ledger-v2-main-loader` | `legacy` |
| MR JALIL closing | PKR 216,300 |
| Unified main RPC (toggle OFF) | 0 |
| Preview compare source (toggle ON) | `unified_compare` |
| Export PDF/Excel/CSV | PKR 216,300 |
| Pilot Batch | 9/9 PASS |
| Party MR JALIL compare | PASS |

## Gate

**Baseline QA PASS** required before production loader enable (Phase 2.10E step 4).

---

*Fill in timestamp, checks, and screenshots after execution.*
