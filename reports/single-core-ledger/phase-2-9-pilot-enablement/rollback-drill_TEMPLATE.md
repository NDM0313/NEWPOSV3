# Phase 2.9 Rollback Drill Log (template)

**Date (UTC):**  
**Executor:**  
**Approver:**  
**Environment:** staging | production DIN CHINA  

## Trigger

Dry-run | Incident (describe):

## Actions taken

| Level | SQL / action | Time (UTC) | Confirmed by |
|-------|--------------|------------|--------------|
| 1 | screen_ledger_v2 OFF | | |
| 2 | pilot OFF | | |
| 3 | engine OFF | | |
| 4 | kill_switch ON (if used) | | |
| 5 | env kill (if used) | | |

## Post-rollback verification

- [ ] Banner `data-unified-ledger-mode` = legacy or killed
- [ ] Main Ledger V2 table matches pre-pilot baseline
- [ ] Export totals unchanged
- [ ] Staff: no preview toggles
- [ ] `SELECT unified_ledger%` flags match expected OFF state

## Result

PASS | FAIL — notes:
