# Device QA checklist — MOBILE APK INTERNAL QA BUILD

**Generated:** 2026-07-01  
**Status:** DEVICE_QA_PENDING (no Android device connected via adb)

## Install

```bash
adb install -r erp-mobile-app/releases/internal-qa/20260701/dincouture-erp-internal-qa-20260701-debug.apk
```

## Rules

- Navigation and read-only verification only
- Do **not** create or edit transactions
- Do **not** print credentials in reports
- Test roles: Admin, Manager, Salesman (restricted)

## Checklist

| # | Check | Admin | Manager | Salesman |
|---|-------|-------|---------|----------|
| 1 | App opens | ☐ | ☐ | ☐ |
| 2 | Login screen works | ☐ | ☐ | ☐ |
| 3 | Login works | ☐ | ☐ | ☐ |
| 4 | Reports hub opens | ☐ | ☐ | ☐ |
| 5 | Financial statements section visible (full accounting role) | ☐ | ☐ | N/A |
| 6 | Balance Sheet opens | ☐ | ☐ | ☐ |
| 7 | Profit & Loss opens | ☐ | ☐ | ☐ |
| 8 | Trial Balance opens | ☐ | ☐ | ☐ |
| 9 | Cash Flow opens | ☐ | ☐ | ☐ |
| 10 | Ledger V2 opens | ☐ | ☐ | ☐ |
| 11 | Account Ledger opens | ☐ | ☐ | ☐ |
| 12 | DIN CHINA totals visible (authorized) | ☐ | ☐ | hidden expected |
| 13 | DIN BRIDAL totals visible (authorized) | ☐ | ☐ | hidden expected |
| 14 | DIN COUTURE totals visible (authorized) | ☐ | ☐ | hidden expected |
| 15 | Salesman hides sensitive totals | N/A | N/A | ☐ |
| 16 | No crash | ☐ | ☐ | ☐ |
| 17 | No blank screen | ☐ | ☐ | ☐ |
| 18 | No chunk/import errors | ☐ | ☐ | ☐ |
| 19 | No mutation APIs called | ☐ | ☐ | ☐ |
| 20 | Logout works | ☐ | ☐ | ☐ |
