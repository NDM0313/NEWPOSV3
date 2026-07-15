# Local rollback rehearsal (non-production)

Tag: `r8-r2-rehearsal-pre-delete-20260715` @ `866cb0df`
Production SQL rollback: **NOT executed**
Tag push: **not pushed** (local only)

## Procedure results

| Step | Result |
|------|--------|
| 1. Stash rehearsal WIP | PASS |
| 2. Checkout pre-delete tag | PASS — HEAD `866cb0df` |
| 3a. Wrapper present (`accountStatementLegacyMainService.ts`) | **True** |
| 3b. Baseline `test:unified-ledger` | **343/343 PASS** |
| 3c. Baseline `test:unit` | **183/183 PASS** |
| 3d. Baseline `build` | **PASS** |
| 4. Checkout rehearsal branch | PASS |
| 5a. Pop stash | PASS |
| 5b. Wrapper present after restore | **False** (deleted as intended) |
| 5c. Rehearsal `test:unified-ledger` | **348/348 PASS** |

## Conclusion

Local L2-style tag checkout restores baseline tree and tests.
Returning to rehearsal branch restores deletion candidate.
**Production rollback SQL was not run.**
