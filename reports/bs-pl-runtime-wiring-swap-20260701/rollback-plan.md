# Rollback plan — BS/P&L unified main loaders (post-swap)

Disable only these four keys for the three pilot companies:

`scripts/single-core-ledger/disable-bs-pl-loader-flags.sql`

Expected: BS/P&L revert to legacy `getBalanceSheet` / `getProfitLoss`. No DB restore required.

Frontend rollback: redeploy prior commit via `deploy/vps-build-erp-only.sh` if wiring must be reverted.
