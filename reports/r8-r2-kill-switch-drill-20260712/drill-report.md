# R8-R2 Kill-Switch Drill (Read-Only)

**Drill result:** PASS (artifacts + tests; no production flag mutation)

| Unified tests | 336/336 PASS |
| Flag guard | PASS |
| Rollback SQL files | 36 |
| Legacy main services retained | 4/4 |
| Soak day | 2 / 30 |
| Code deletion | DEFERRED_POST_SOAK until 2026-08-09 |

R8-R2 physical code deletion remains scheduled after soak + operator `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.