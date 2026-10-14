# Phase 2.10E — Production loader enable QA (loader ON)

**Status:** **PENDING — not executed**  
**Prerequisite:** Baseline QA PASS + ops approval + `phase-210d-enable-loader-soak.sql` (production description) on DIN CHINA only

## Execute after loader enable

```powershell
$env:QA_BROWSER_BASE_URL = 'https://erp.dincouture.pk'
$env:QA_BROWSER_PASSWORD = '<admin password>'
node scripts/single-core-ledger/run-phase-210-loader-browser-qa.mjs candidate
```

## Expected results

| Check | Expected |
|-------|----------|
| `data-ledger-v2-main-loader` | `unified` |
| MR JALIL main closing | PKR 216,300 |
| Unified main-loader RPC on load | ≥ 1 |
| Preview compare source (toggle ON) | `legacy_shadow` |
| Export PDF/Excel/CSV | PKR 216,300 |
| Pilot Batch | 9/9 PASS |
| Party MR JALIL compare | PASS |
| Other screen/company flags | None |

---

*Fill in after execution.*
