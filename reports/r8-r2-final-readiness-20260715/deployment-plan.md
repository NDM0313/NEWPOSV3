# Future R8-R2 Deployment Plan

Frontend-only. No DB migrations. No GL mutations. No Play Store.

## Ordered steps

1. Pull latest `main`
2. Verify **calendar date ≥ 2026-08-09** (stop if earlier)
3. Verify approval phrase exactly: `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`
4. Run operator-attended kill-switch drill (runbook) — **stop if fail**
5. Confirm post-drill monitoring PASS ×3 + loader guard
6. Create pre-deletion Git tag `r8-r2-pre-code-deletion-YYYYMMDD` on current production-ready commit
7. Create dedicated branch `r8-r2-code-deletion-YYYYMMDD`
8. Delete only approved thin wrappers + page branches; retarget shadow imports
9. Update imports/tests/docs
10. Full validation (tests + build + optional local monitor)
11. Review staged files (exclude graphify, mobile, import-gap, credentials)
12. Commit
13. Push branch → merge to `main` per workflow
14. Deploy **frontend only** (`deploy/vps-build-erp-only.sh` via `ssh dincouture-vps`)
15. Verify production HTTP 200 + healthy + commit hash
16. Post-deploy monitoring PASS
17. Preserve tag + L1 SQL for rollback
18. Closeout docs + evidence pack

## Must not combine with

Contacts migration · mobile refactor · Play Store · AR/AP basis changes · accounting repairs · Roznamcha feature work · cashbook/import-gap · graphify updates · unrelated cleanup
