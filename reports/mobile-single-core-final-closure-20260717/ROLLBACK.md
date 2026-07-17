# ROLLBACK.md

1. Do not merge without `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`.
2. Revert feature branch or disable unified loader flags if needed.
3. No migrations applied — no SQL rollback.
4. Do not merge over dirty `main` WIP.
