# Rollback rehearsal

**LOCAL ONLY — no production SQL rollback**

## Pre-delete tag

- Name: `r8-r2-rehearsal-pre-delete-20260715`
- Points to: `9f0e237abea77bd12b61fc72e1a77ee8ac7b35fc` (current main at rehearsal start)
- Pushed: **NO** (local tag)

## Steps executed

1. Recorded rehearsal commit `b89cdd76`
2. Checked out `r8-r2-rehearsal-pre-delete-20260715`
3. Confirmed wrappers present; `test:unified-ledger` 345/345; `test:unit` 188/188
4. Checked out `rehearsal/r8-r2-legacy-deletion-20260715`
5. Confirmed wrappers absent; `test:unified-ledger` 350/350; `test:unit` 188/188

## Result

| Check | Result |
|-------|--------|
| Baseline restoration | PASS |
| Rehearsal restoration | PASS |
| Production rollback SQL | **NOT EXECUTED** |

## Post-merge rollback note

After future production merge, L1 flag rollback alone does **not** restore in-page legacy branches. Use L2 checkout of production pre-delete tag or revert merge + redeploy frontend. L0 kill forces resolver=`legacy` → pages **fail closed**.
