# PR_FILE_REVIEW.md

## Result: CLEAN_FOR_PR (with evidence packs)

Compared `origin/main...feature/mobile-single-core-finalization` (~160 files / 18 commits at review start).

### Included (expected)

- `erp-mobile-app/src/api/singleCore/**` adapter, cache, pure mappers, tests
- Party / Roznamcha / Worker / Cash Flow / AccountsModule / report screens
- Write-path invalidation in sales/purchases/expenses/accounts/rentals/studio
- `reports/mobile-single-core-*-20260717/**` evidence
- `scripts/mobile-single-core-*.mjs` QA tooling (non-secret)

### Excluded / not present in PR tree

- Graphify corpus dumps (not in branch diff vs main for this feature)
- Historical release APK/AAB binaries
- `.env` / secrets / keystore files
- Local SDK/JDK override files
- Emulator AVD state

### Notes

- Emulator screenshots under `reports/.../final-closure` are **evidence**, not product runtime assets — keep for audit trail.
- No force history rewrite / squash performed (shared remote branch).
- Dirty `main @ 812c2871` working tree not modified.
