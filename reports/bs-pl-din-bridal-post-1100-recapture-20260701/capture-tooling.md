# Capture tooling — Phase 3D BS/P&L

## Scripts

| Path | Role |
|------|------|
| `scripts/single-core-ledger/run-phase-3d-bs-pl-golden-capture.mjs` | Playwright read-only production capture (legacy vs unified preview) |
| `scripts/single-core-ledger/generate-phase-3d-reports.mjs` | Regenerate markdown/json reports from export JSON |

## Output directories

- `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/exports/`
- `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/screenshots/`
- `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/capture-raw.json`

## DIN BRIDAL only?

**Not supported** — script iterates all three companies (`PROFILE_ORDER`). This run captures all three; **DIN BRIDAL post-1100** is the analysis target.

## Commands

```powershell
cd "c:\Users\ndm31\dev\Corusr\NEW POSV3"
Get-Content "erp-mobile-app\.env" | ForEach-Object { if ($_ -match '^\$env:(\w+)\s*=\s*"(.*)"') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] } }
node scripts/single-core-ledger/run-phase-3d-bs-pl-golden-capture.mjs
node scripts/single-core-ledger/generate-phase-3d-reports.mjs
```

## Constraints honored

- Read-only browser QA — no flag toggles, no loader swap, no DB writes
- Preview toggle checked in UI only (compare panel); main loaders unchanged
