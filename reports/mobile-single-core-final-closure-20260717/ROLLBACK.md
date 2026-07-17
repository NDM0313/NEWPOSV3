# ROLLBACK.md

1. Do not merge without `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`.
2. Revert feature branch or disable unified loader flags if needed after merge.
3. No migrations applied — no SQL rollback.
4. Leave dirty `main @ 812c2871` untouched.
