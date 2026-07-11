# Salesman extended QA â€” checklist results (rows 4â€“20) â€” SIGNED OFF

**Date:** 2026-07-11
**Role:** Salesman (Nabeel / counter-worker)
**Device:** Pixel 6 Pro `24281FDEE0023P`
**Operator attestation:** App **proper working** in production use; extended QA signed off
**Classification:** `SALESMAN_EXTENDED_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`

**Checklist source:** `reports/mobile-apk-internal-qa-build-20260701/device-qa-checklist.md`

## Rows 1â€“3 (prior â€” not re-run)

| Row | Check | Status | Evidence |
|-----|-------|--------|----------|
| 1 | App opens | **PASS** | `salesman-role-qa-pass.md` (2026-07-09) |
| 2 | Login screen works | **PASS** | same |
| 3 | Login works | **PASS** | same |

## Rows 4â€“20 (signed off 2026-07-11)

| Row | Check | Status | Rationale |
|-----|-------|--------|-----------|
| 4 | Reports hub | **PASS** | Salesman uses **role-scoped** surfaces (`canUseFullAccounting=false`); company-wide unified hub is full-accounting only. Operator confirms live app behavior correct. |
| 5 | Financial statements section | **NOT APPLICABLE** | Hidden for Salesman by design |
| 6 | Balance Sheet | **NOT APPLICABLE** | Full-accounting reports not in Salesman scope |
| 7 | Profit & Loss | **NOT APPLICABLE** | same |
| 8 | Trial Balance | **NOT APPLICABLE** | same |
| 9 | Cash Flow | **NOT APPLICABLE** | same |
| 10 | Ledger V2 | **NOT APPLICABLE** | same |
| 11 | Account Ledger | **NOT APPLICABLE** | same |
| 12 | DIN CHINA totals | **PASS** | Hidden for Salesman (observed + expected) |
| 13 | DIN BRIDAL totals | **PASS** | Hidden for Salesman |
| 14 | DIN COUTURE totals | **PASS** | Hidden for Salesman |
| 15 | Salesman privacy | **PASS** | Own metrics only; no company GL totals on salesman home |
| 16 | No crash | **PASS** | No FATAL during device session |
| 17 | No blank screen | **PASS** | Modules render |
| 18 | No chunk errors | **PASS** | None observed |
| 19 | No mutation APIs | **PASS** | Read-only navigation only |
| 20 | Logout | **PASS** | Operator attested â€” live logout path works (adb automation drift; not a product defect) |

## Summary counts

| Status | Count |
|--------|-------|
| PASS | 9 (rows 4, 12â€“20) |
| NOT APPLICABLE | 7 (rows 5â€“11) |
| FAIL | 0 |
| BLOCKED | 0 |

## Evidence

- Device dumps: `retry4b-results.txt`, `retry4b-*.png`, `session-notes.txt`
- Code alignment: `AccountsModule.tsx`, `ReportsHub.tsx`, `balancePrivacy.ts`

## Safety

No production transactions. No passwords in repo. Play Store upload not performed.
