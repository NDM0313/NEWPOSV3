# Rollback and safety notes — Phase 3A

## Instant rollback (no DB)

1. Uncheck preview toggle — legacy report only
2. Deploy previous web build if UI must be removed entirely

## What does NOT need rollback

- Feature flags (none added)
- Migrations (none)
- GL / journal data (unchanged)

## Kill switch

If `unified_ledger_kill_switch` active, preview shows blocked message; legacy main unaffected.

## Staff users

Preview toggle not visible — default experience identical to pre–Phase 3A.

## Loader swap

**Not approved.** L1 rollback for future BS/P&L loaders = flag OFF per runbook (not implemented this phase).
