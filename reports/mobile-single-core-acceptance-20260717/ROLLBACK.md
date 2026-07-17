# ROLLBACK.md

1. Do not merge without `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`.
2. Revert/feature-flag off unified loaders if needed.
3. No migrations applied → no SQL rollback.
4. Leave dirty main WIP untouched.
