# BS/P&L recapture execution

**Executed:** 2026-07-01  
**Mode:** Read-only Playwright capture

| Company | Balance Sheet | P&L |
|---------|---------------|-----|
| DIN CHINA | CAPTURED pass=true | CAPTURED pass=true |
| **DIN BRIDAL** | **CAPTURED pass=true** | **CAPTURED pass=true** |
| DIN COUTURE | CAPTURED pass=true | CAPTURED pass=true |

**Commands:**
- `node scripts/single-core-ledger/run-phase-3d-bs-pl-golden-capture.mjs`
- `node scripts/single-core-ledger/generate-phase-3d-reports.mjs`

**Exit code:** 0  
**Duration:** ~5.5 minutes  
**Flags toggled:** None  
**DB mutations:** None  
**Output:** `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/`
