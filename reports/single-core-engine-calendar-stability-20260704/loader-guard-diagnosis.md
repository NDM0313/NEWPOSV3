# Loader guard diagnosis — Calendar Day 4

**Run local date/time:** 2026-07-04

## Initial failure

| Item | Value |
|------|--------|
| Classification | **MONITORING_GUARD_HARNESS_BUG** |
| Error | `spawnSync powershell.exe ENOENT` |
| Artifact | `three-company-monitoring-2026-07-03T19-14-05-255Z` |
| Root cause | Home Mac cannot spawn Windows-only `powershell.exe` for SSH SQL pipe |

## Fix applied

| Item | Value |
|------|--------|
| Approach | Node stdin piping via `execSqlViaSsh` / `execSqlFileViaSsh` |
| New modules | `monitoringSshSql.mjs`, `threeCompanyLoaderGuard.mjs` |
| Updated scripts | `run-three-company-operational-monitoring.mjs`, `run-phase-216-monitoring-verify.mjs` |
| Tests | `monitoringSshSql.test.mjs`, `threeCompanyLoaderGuard.test.mjs` |
| Production logic changed | **no** |
| SQL semantics changed | **no** |

## Final guard result

| Item | Value |
|------|--------|
| Loader guard | **PASS** |
| DIN CHINA loaders | 8 |
| DIN BRIDAL loaders | 8 |
| DIN COUTURE loaders | 8 |
| Other companies | 0 |
| Real regression | **no** |
