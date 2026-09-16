# Rollback plan — BS/P&L loader swap

**Prepared:** 2026-07-01 (before any flag changes)  
**Swap executed this run:** no  
**DB restore required:** no — no GL/data mutation

## Flag keys (per company, when wiring exists)

Disable only these four keys for DIN CHINA, DIN BRIDAL, DIN COUTURE:

- `unified_ledger_loader_balance_sheet`
- `unified_ledger_loader_profit_loss`
- `unified_ledger_screen_balance_sheet`
- `unified_ledger_screen_profit_loss`

**Do not change:** Cash Flow, Ledger V2, Account Statement, Trial Balance, Roznamcha, Party Ledger, kill switch, or any other company.

## Company IDs

| Company | UUID |
|---------|------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |
| DIN BRIDAL | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` |
| DIN COUTURE | `2ab65903-62a3-4bcf-bced-076b681e9b74` |

## Expected result

BS and P&L pages use legacy main loaders (`accountingReportsService.getBalanceSheet` / `getProfitLoss`).

## Verification after rollback

```bash
npm run monitor:three-company-unified-ledger
npm run test:unified-ledger
npm run test:unit
```

## Frontend rollback

If a frontend deploy was performed: `bash deploy/vps-build-erp-only.sh` with prior known-good commit.  
**This run:** no deploy — N/A.
