# Rollback readiness

**Result:** PASS

## Assets verified

| Asset | Status |
|-------|--------|
| `scripts/single-core-ledger/disable-bs-pl-loader-flags.sql` | present — disables 4 BS/P&L keys only |
| `scripts/single-core-ledger/enable-bs-pl-loader-flags.sql` | present — re-enable |
| `reports/bs-pl-runtime-wiring-swap-20260701/rollback-plan.md` | present |

## Rollback scope

**Keys only (4):**

- `unified_ledger_loader_balance_sheet`
- `unified_ledger_loader_profit_loss`
- `unified_ledger_screen_balance_sheet`
- `unified_ledger_screen_profit_loss`

**Companies only (3):** DIN CHINA, DIN BRIDAL, DIN COUTURE

Does **not** touch Cash Flow flags or other companies.

Frontend rollback: redeploy prior commit via `deploy/vps-build-erp-only.sh` if wiring must be reverted.
