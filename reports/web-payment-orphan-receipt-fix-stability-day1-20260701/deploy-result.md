# Deploy decision

| Gate | Status |
|------|--------|
| Frontend-only changes | **yes** (no migrations) |
| test:unified-ledger | PASS |
| test:unit | PASS |
| build | PASS |
| Cleanup verification | PASS |
| Post-fix monitoring | **FAIL** (DIN BRIDAL Roznamcha golden drift −90k after orphan void) |
| Credentials staged | none |

**Decision:** **DEFERRED** — frontend deploy not run. Post-fix monitoring FAIL is classified as expected Roznamcha correction after orphan void; operator may approve `deploy/vps-build-erp-only.sh` after reviewing evidence. No DB migrations required.

**Production mutations this run:** soft void only (RCV-0081/0082 + JE-0209/0210); no new GL lines.
