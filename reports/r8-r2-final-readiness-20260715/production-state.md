# Production State Verification (read-only, 2026-07-15)

| Check | Result |
|-------|--------|
| HTTP `https://erp.dincouture.pk` | **200** |
| erp-frontend | **healthy** |
| VPS git HEAD | `b8fec34b` |
| `VITE_BUILD_COMMIT` | `b8fec34b` (includes AR/AP runtime `a5149971` ancestor) |
| AR/AP parity UI string in bundle | present (`Parity baseline`) |
| Unified loader flags (3 companies) | **54 ON** |
| Kill switch enabled rows | **0** (OFF / absent) |
| Legacy fallback code | retained in tree |
| Deploy this session | **none** |

## Area table

| Area | GitHub state | Production state | Verified | Remaining action |
|------|--------------|------------------|----------|------------------|
| Core unified engine | R8-R1 complete; 8 loaders ON in ops docs | Flags 54 ON; kill OFF | YES | Maintain |
| AR/AP Phase 2b | `a5149971` + docs closeout | Runtime on VPS; official_gl parity PASS | YES | None core |
| Monitoring | Last PASS 2026-07-12 | Fresh browser: CREDENTIAL_GATE | PARTIAL | Re-run with shell QA env when available |
| R8-R1 | Tag + docs COMPLETE | Loaders canonical | YES | None |
| R8-R2 | Readiness only; no deletion | Code still present | YES | Wait until **2026-08-09** + approval + drill |
| Mobile/Play Store | QA PASS; upload SKIPPED | N/A core | YES | OUTSIDE R8-R2 |
