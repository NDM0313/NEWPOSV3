# Mobile role QA readiness

**Device:** Pixel 6 Pro (Android 16)  
**APK:** Internal QA debug 1.0.5 / 39 — local only, not in git

## Current status

| Role | Status |
|------|--------|
| Admin | **ADMIN_QA_PASS** — 21/21 (operator Nadeem Khan) |
| Manager | **MANAGER_QA_PENDING_CREDENTIALS** |
| Salesman | **SALESMAN_QA_PENDING_CREDENTIALS** |
| Overall | **PARTIAL_DEVICE_QA** |

## Admin goldens verified (device)

| Company | BS Assets | P&L Net |
|---------|-----------|---------|
| DIN CHINA | 89,754,087.52 | 8,465,730.87 |
| DIN BRIDAL | 13,521,792 | 119,992 |
| DIN COUTURE | 22,667,273 | -16,750 |

Filters: BS as-of 2026-07-01; P&L 2026-01-01..2026-07-01; basis `official_gl`; all branches.

**Admin QA remains valid** — DIN BRIDAL monitoring drift is in roznamcha/TB monitoring goldens, not BS/P&L screens verified on device.

## Manager QA checklist

1. Install internal QA APK if needed (`erp-mobile-app/releases/internal-qa/20260701/`)
2. Login with Manager credentials (do not commit credentials)
3. Dashboard loads — no crash
4. Reports Hub → Financial Statements visible
5. Balance Sheet — opens and loads
6. Profit & Loss — opens and loads
7. Trial Balance — opens and loads
8. Cash Flow — opens and loads
9. Ledger V2 — party search and statement
10. Account Ledger — account entries view
11. Confirm Manager RBAC boundaries (no admin-only settings)
12. Permitted operational screen per role policy
13. No unintended production mutations
14. Logout works

## Salesman QA checklist

1. Install internal QA APK if needed
2. Login with Salesman credentials (do not commit credentials)
3. Sales/POS home loads
4. Permitted reports only (per RBAC)
5. Cannot access admin GL/settings
6. Branch-assigned screens navigation pass
7. No crash / blank screen
8. No production mutations unless approved test
9. Logout works

## Public release gate

Blocked until:
- DIN BRIDAL monitoring drift is understood or operator-approved golden refresh completed, **and**
- Role QA policy decided (Manager/Salesman completion if required)

**No Play Store upload. APK not committed to git.**
