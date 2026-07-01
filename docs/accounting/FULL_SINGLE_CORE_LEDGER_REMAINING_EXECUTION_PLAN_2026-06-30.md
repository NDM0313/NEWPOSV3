# Full Single Core Ledger — remaining execution plan

**Generated:** 2026-06-30 (updated 2026-07-01 — BS/P&L swap complete + stability closure)  
**Branch:** `main` @ `42459bde`

## Completed / stable

- Three-company unified loaders (incl. Cash Flow main live 2026-06-29)
- Admin Compare 9/9 PASS
- Party Discount JE-0003 retained; monitoring aligned
- Hostinger SMTP + `autoconfirm=false` + sender **NDM ERP SYSTEM**
- **Create Business OTP E2E COMPLETE** (Phase A + B, bootstrap cleanup)
- **DIN BRIDAL 1100 Option C apply COMPLETE** — control 1100 zero (JV-000209, JV-000210)
- **DIN BRIDAL TB golden fixture refreshed** — 22,056,075 (post-apply monitoring PASS)

## Remaining phases (approval-gated)

| Phase | Status | Next action |
|-------|--------|-------------|
| Create Business OTP E2E | **COMPLETE** | — |
| GL backlog C1–C3 | **Closed** | None |
| GL backlog C4 DIN BRIDAL 1100 | **COMPLETE** — Option C applied + TB golden refreshed | None |
| Cash Flow 3B-M | **LIVE** | Rollback only with written approval |
| BS/P&L loader swap | **COMPLETE** | Runtime wiring + frontend deploy + flags enabled 2026-07-01 — see `reports/bs-pl-runtime-wiring-swap-20260701/` |
| Mobile parity | **CODE COMPLETE** — Capacitor unified reports 2026-07-01; **APK BUILT_INTERNAL_QA** (debug); **device QA BLOCKED** — no adb device 2026-07-01 | Connect Android device and complete on-device QA |
| R8 legacy retirement | **BLOCKED** | 2–4 week stable run |
| Supplier party_discount QA | **Not approved** | Separate PKR 1 approval |

## Evidence

[`reports/remaining-tasks-start-20260630/`](../reports/remaining-tasks-start-20260630/)  
[`reports/create-business-otp-phase-a-request-20260630/`](../reports/create-business-otp-phase-a-request-20260630/)  
[`reports/create-business-otp-phase-b-verify-20260630/`](../reports/create-business-otp-phase-b-verify-20260630/)  
[`reports/din-bridal-1100-dry-run-approval-20260630/`](../reports/din-bridal-1100-dry-run-approval-20260630/)  
[`reports/din-bridal-1100-option-c-apply-20260630/`](../reports/din-bridal-1100-option-c-apply-20260630/)  
[`reports/final-office-home-handoff-20260630/`](../reports/final-office-home-handoff-20260630/)  
[`OFFICE_TO_HOME_FINAL_HANDOFF_2026-06-30.md`](OFFICE_TO_HOME_FINAL_HANDOFF_2026-06-30.md)  
[`reports/office-resume-bs-pl-approval-20260701/`](../reports/office-resume-bs-pl-approval-20260701/)  
[`reports/bs-pl-din-bridal-post-1100-recapture-20260701/`](../reports/bs-pl-din-bridal-post-1100-recapture-20260701/)  
[`reports/bs-pl-controlled-loader-swap-20260701/`](../reports/bs-pl-controlled-loader-swap-20260701/)  
[`reports/bs-pl-runtime-wiring-swap-20260701/`](../reports/bs-pl-runtime-wiring-swap-20260701/)  
[`reports/post-bs-pl-swap-stability-mobile-readiness-20260701/`](../reports/post-bs-pl-swap-stability-mobile-readiness-20260701/)  
[`reports/mobile-reports-parity-implementation-20260701/`](../reports/mobile-reports-parity-implementation-20260701/)  
[`reports/mobile-apk-internal-qa-build-20260701/`](../reports/mobile-apk-internal-qa-build-20260701/)  
[`reports/mobile-apk-device-qa-20260701/`](../reports/mobile-apk-device-qa-20260701/)

## BS/P&L controlled loader swap — COMPLETE (2026-07-01)

| Item | Result |
|------|--------|
| Runtime wiring | **COMPLETE** — commit `db499995` |
| Evidence commit | `98d2f4c8` (+ push verify `42459bde`) |
| Frontend deploy | **COMPLETE** — `deploy/vps-build-erp-only.sh` @ `db499995` |
| Flags enabled | **yes** — 4 keys × 3 companies |
| Post-swap stability | **PASS** — [`post-bs-pl-swap-stability-mobile-readiness-20260701/`](../reports/post-bs-pl-swap-stability-mobile-readiness-20260701/) |
| Post-flag capture | **6/6 ZERO_DIFF pass** |
| Monitoring / tests / build | **PASS** (328/328 unified-ledger) |

**Next:** Connect Android test device via USB (adb), install internal debug APK, complete Admin/Manager/Salesman device QA (`BLOCKED_DEVICE_QA` — no adb device 2026-07-01). Public release / Play Store requires separate operator approval. Supplier Party Discount PKR 1 QA remains separate approval. Do **not** run R8 until 2–4 week stable run.

## Exact next recommended phase

1. **Mobile parity plan** or **supplier Party Discount PKR 1 QA** — separate approval only
2. **R8 legacy retirement** — blocked until 2–4 week stable run after BS/P&L swap

Do **not** auto-run GL repairs, supplier JE, or R8 retirement.
