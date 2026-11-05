# ERP Flutter v2 — QA session log

**App:** `erp-flutter-v2/` · version `2.0.0+1`  
**Backend:** `https://erp.dincouture.pk`  
**Use test company only** for money scenarios.

## Pre-flight

- [ ] `flutter pub get` succeeds
- [ ] `flutter analyze` — no errors
- [ ] Login with admin + salesman
- [ ] Branch picker works

## Money flows (test company)

| # | Scenario | Pass | Notes |
|---|----------|------|-------|
| 1 | Draft sale → finalize → receive payment | | |
| 2 | POS + barcode one SKU | | |
| 3 | Purchase draft → finalize → supplier payment | | |
| 4 | Expense create (GL posted) | | |
| 5 | Inventory adjustment changes stock | | |
| 6 | Sales report totals match list | | |
| 7 | Offline draft sale → reconnect sync | | |

## Capacitor parity (same user/branch)

| Check | Capacitor | Flutter v2 | Match |
|-------|-----------|------------|-------|
| Product count | | | |
| One contact AR balance | | | |
| One finalized sale paid/due | | | |

## Sign-off

- **Tester:**
- **Date:**
- **Approved for pilot APK:**
