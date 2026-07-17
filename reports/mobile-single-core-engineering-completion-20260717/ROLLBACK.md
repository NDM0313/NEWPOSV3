# ROLLBACK.md

## Product rollback

1. Revert the engineering-completion product commit(s) on `feature/mobile-single-core-finalization` (or reset branch to pre-completion SHA if not shared further — prefer revert on shared branch).
2. Last known pre-completion product boundary: `93cd8436` (evidence) with product through `bdbf602d`.
3. Rebuild APK from the rolled-back commit; replace installed debug builds.

## Do not

- Reset / clean dirty `main @ 812c2871`
- Force-push shared history unless operators explicitly request
- Roll back production database (no migrations shipped)

## Evidence rollback

Evidence directories under `reports/mobile-single-core-*` are additive; leaving them is safe. Deleting them is optional and does not affect runtime.
