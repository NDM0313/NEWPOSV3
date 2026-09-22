# R8-R2 production verification evidence — 2026-07-17

## Runtime

- VPS HEAD = `812c2871`
- `VITE_BUILD_COMMIT` = `812c2871`
- Deletion included via ancestor `390f922c`
- Rollback tag = `r8-r2-pre-code-deletion-20260717` → `17a6c131`

## Results

- Six-screen spot-check: **PASS** (`six-screen-spotcheck.md`)
- `test:unified-ledger`: 350/350
- `test:unit`: 188/188
- `build`: PASS
- HTTP 200 / erp-frontend healthy
- Three-company monitoring: overall FAIL (china MR JALIL golden drift only); loaders + pilot batch OK; goldens unchanged; no rollback

## Markers

- R8_R2_PRODUCTION_VERIFIED_COMPLETE
- SINGLE_CORE_ENGINE_TECHNICALLY_CLOSED
- SINGLE_CORE_ENGINE_FULLY_RETIRED_FOR_APPROVED_SCOPE
