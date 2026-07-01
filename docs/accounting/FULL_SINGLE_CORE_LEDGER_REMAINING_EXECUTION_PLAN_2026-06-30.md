# Full Single Core Ledger — remaining execution plan

**Generated:** 2026-06-30 (updated 2026-07-01 — Single Core Engine stability window **STARTED**)  
**Branch:** `main` @ stability window baseline evidence (pending push)

## Completed / stable

- Three-company unified loaders (incl. Cash Flow main live 2026-06-29)
- Admin Compare 9/9 PASS
- Party Discount JE-0003 retained; monitoring aligned
- Hostinger SMTP + `autoconfirm=false` + sender **NDM ERP SYSTEM**
- **Create Business OTP E2E COMPLETE** (Phase A + B, bootstrap cleanup)
- **DIN BRIDAL 1100 Option C apply COMPLETE** — control 1100 zero (JV-000209, JV-000210)
- **DIN BRIDAL TB golden fixture refreshed** — 22,390,400 (July 1 live-activity refresh; monitoring PASS)
- **Single Core Engine stability window STARTED** — 2026-07-01; day-0 monitoring PASS

## Remaining phases (approval-gated)

| Phase | Status | Next action |
|-------|--------|-------------|
| Create Business OTP E2E | **COMPLETE** | — |
| GL backlog C1–C3 | **Closed** | None |
| GL backlog C4 DIN BRIDAL 1100 | **COMPLETE** — Option C applied + TB golden refreshed | None |
| Cash Flow 3B-M | **LIVE** | Rollback only with written approval |
| BS/P&L loader swap | **COMPLETE** | Runtime wiring + frontend deploy + flags enabled 2026-07-01 — see `reports/bs-pl-runtime-wiring-swap-20260701/` |
| Mobile parity | **CODE COMPLETE** — APK **BUILT_INTERNAL_QA** on Pixel 6 Pro; **Admin manual QA PASS** (21/21); **PARTIAL_DEVICE_QA** (Manager/Salesman pending) 2026-07-01 | Manager/Salesman role QA; release gate **BLOCKED_PARTIAL_DEVICE_QA_PENDING_ROLES** |
| DIN BRIDAL monitoring drift | **CLOSED** — legitimate live activity; fixture-only golden refresh **COMPLETE** (operator Nadeem Khan 2026-07-01) | None — monitoring PASS |
| R8 legacy retirement | **BLOCKED** | Stability window 2–4 weeks from 2026-07-01; final approval required |
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
[`reports/mobile-apk-manual-admin-qa-20260701/`](../reports/mobile-apk-manual-admin-qa-20260701/)  
[`reports/din-bridal-monitoring-drift-mobile-role-readiness-20260701/`](../reports/din-bridal-monitoring-drift-mobile-role-readiness-20260701/)  
[`reports/din-bridal-july1-gl-activity-audit-20260701/`](../reports/din-bridal-july1-gl-activity-audit-20260701/)  
[`reports/din-bridal-monitoring-golden-refresh-20260701/`](../reports/din-bridal-monitoring-golden-refresh-20260701/)  
[`reports/single-core-engine-stability-window-20260701/`](../reports/single-core-engine-stability-window-20260701/)

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

**Next:** Complete Manager/Salesman on-device role QA when credentials available. Play Store requires separate approval. No GL mutations.

## DIN BRIDAL July 1 golden refresh — COMPLETE (2026-07-01)

| Metric | New golden (PKR) |
|--------|------------------|
| Trial Balance total | **22,390,400** |
| Roznamcha Cash In | **2,116,850** |
| Roznamcha Cash Out | **917,780** |
| Roznamcha Closing | **1,199,070** |

Fixture-only; no production data mutation. Post-refresh monitoring **PASS**.

## Single Core Engine stability window — STARTED (2026-07-01)

| Item | Value |
|------|-------|
| Start date | **2026-07-01** |
| Duration | **2–4 weeks** (earliest R8 review ~2026-07-15) |
| Day-0 monitoring | **PASS** — DIN CHINA / DIN BRIDAL / DIN COUTURE; Admin Compare 9/9 |
| Day-0 tests/build | 328/328 unified · 122/122 unit · build PASS |
| Production mutation | **none** |
| R8 legacy retirement | **BLOCKED** until window complete + final approval |
| 4th company rollout | **BLOCKED** — finance sign-off required |
| Mobile release | **Separate track** — `BLOCKED_PARTIAL_DEVICE_QA_PENDING_ROLES` |

Evidence: [`reports/single-core-engine-stability-window-20260701/`](../reports/single-core-engine-stability-window-20260701/)

## Exact next recommended phase

1. **Daily monitoring** during stability window — `npm run monitor:three-company-unified-ledger`
2. **Manager/Salesman device QA** — mobile release separate track
3. **R8 legacy retirement** — blocked until stability window complete + final approval

Do **not** auto-run GL repairs, supplier JE, or R8 retirement.
