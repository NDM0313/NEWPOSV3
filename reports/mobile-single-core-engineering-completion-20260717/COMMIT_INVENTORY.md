# COMMIT_INVENTORY.md

Range: `origin/main...HEAD` on `feature/mobile-single-core-finalization`  
Include policy: product + required tests/docs/scripts for Single Core. Exclude: Graphify, secrets, local SDK overrides, historical binary APKs (none found in PR file list).

| Commit | Class | Subject | Include |
|--------|-------|---------|---------|
| 4cdbae78 | product | refactor(mobile): add central single core report adapter | INCLUDE |
| e7e06e55 | product | feat(mobile): wire party ledger to unified party contract | INCLUDE |
| ba3d593b | product | feat(mobile): wire roznamcha to unified cash bank contract | INCLUDE |
| f90cd771 | product | fix(mobile): expose accounting loader errors and fallback basis | INCLUDE |
| 2bec75f9 | product | test(mobile): add single core loader and scope coverage | INCLUDE |
| 3c9dc407 | evidence | docs(mobile): add phase 2 wiring evidence | INCLUDE (evidence) |
| 135ab47a | product | feat(mobile): align worker ledger accounting basis | INCLUDE |
| 081fadfe | product | fix(mobile): remove cash flow silent legacy fallback | INCLUDE |
| 26752a96 | product | fix(mobile): invalidate accounting reports after writes | INCLUDE |
| bdbf602d | product | test(mobile): cover role scope and remaining single core loaders | INCLUDE |
| 93cd8436 | evidence | docs(mobile): add finalization and parity evidence | INCLUDE |
| a7676a07 | evidence | docs(mobile): add Single Core acceptance evidence pack | INCLUDE |
| 8bcff16d | evidence | docs(mobile): complete acceptance QA tooling and evidence | INCLUDE |
| 8f0f73a9 | evidence | docs(mobile): add Single Core closure gate evidence | INCLUDE |
| 3a20fc5a | evidence | docs(mobile): add final-closure gate evidence and CDP scripts | INCLUDE |
| 39cd6cec | evidence | docs(mobile): refresh operational gate results for final closure | INCLUDE |
| b3f10fee | evidence | docs(mobile): record resource-gate blockers and temp QA user plan | INCLUDE |
| 382727db | evidence | docs(mobile): record decision-gate status without Path A/B approvals | INCLUDE |
| *(this phase)* | product+docs | engineering completion invalidation + fail-loud + docs | INCLUDE |

Prior product HEAD marker `93cd8436` remains the last **pre-engineering-completion** product-evidence boundary; this phase adds a new product commit after verification.
