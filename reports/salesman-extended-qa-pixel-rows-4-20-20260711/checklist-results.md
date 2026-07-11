# Salesman extended QA — checklist results (rows 4–20)

**Date:** 2026-07-11  
**Role:** Salesman only  
**Device gate:** **BLOCKED** — adb empty (no Pixel attached)  
**Checklist source:** `reports/mobile-apk-internal-qa-build-20260701/device-qa-checklist.md`

## Rows 1–3 (prior session — not re-run)

| Row | Check | Status | Evidence |
|-----|-------|--------|----------|
| 1 | App opens | **PASS** | `reports/mobile-salesman-qa-readiness-after-day15-20260709/salesman-role-qa-pass.md` (2026-07-09) |
| 2 | Login screen works | **PASS** | same |
| 3 | Login works | **PASS** | same (operator attested) |

## Rows 4–20 (this session)

All rows **BLOCKED** — device not connected. No password requested. No app session opened.

| Row | Screen/module | Test action | Expected result | Actual result | Status | Evidence | Production data changed |
|-----|---------------|-------------|-----------------|---------------|--------|----------|-------------------------|
| 4 | Reports hub | Open Reports from nav | Hub loads | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 5 | Financial statements | Section visible for full accounting role | N/A for Salesman | Not executed | **NOT APPLICABLE** | checklist rule | no |
| 6 | Balance Sheet | Open report | Screen loads read-only | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 7 | Profit & Loss | Open report | Screen loads read-only | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 8 | Trial Balance | Open report | Screen loads read-only | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 9 | Cash Flow | Open report | Screen loads read-only | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 10 | Ledger V2 | Open report | Screen loads read-only | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 11 | Account Ledger | Open report | Screen loads read-only | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 12 | DIN CHINA totals | View totals if authorized | Hidden for Salesman | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 13 | DIN BRIDAL totals | View totals if authorized | Hidden for Salesman | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 14 | DIN COUTURE totals | View totals if authorized | Hidden for Salesman | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 15 | Salesman privacy | Sensitive totals masked | Totals hidden | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 16 | Stability | Navigate reports | No crash | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 17 | Stability | Navigate reports | No blank screen | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 18 | Stability | Navigate reports | No chunk/import errors | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 19 | Mutation guard | Read-only navigation only | No mutation APIs | Not executed | **BLOCKED** | `adb-status.txt` | no |
| 20 | Logout | Log out from app | Returns to login | Not executed | **BLOCKED** | `adb-status.txt` | no |

## Summary counts

| Status | Count |
|--------|-------|
| PASS | 0 |
| FAIL | 0 |
| BLOCKED | 16 |
| NOT APPLICABLE | 1 (row 5) |

## Operator action to unblock

1. Connect Pixel 6 Pro via USB
2. Enable Developer options → USB debugging
3. Approve “Allow USB debugging” on device
4. Confirm `adb devices` shows `24281FDEE0023P	device`
5. Re-run this checklist session
