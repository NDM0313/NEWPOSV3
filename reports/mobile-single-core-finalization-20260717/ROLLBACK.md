# ROLLBACK.md

1. Do not merge without approval.
2. Revert finalization commits or reset feature branch tip.
3. Feature flags / kill switch disable unified paths without DB rollback.
4. No migrations applied → no SQL rollback.
5. Leave dirty main WIP untouched.
