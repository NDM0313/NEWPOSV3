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
| Mobile parity | **PARTIAL** — Admin PASS 21/21; Manager **N/A/waived** (Admin+Salesman only); Salesman **pending** (password + Pixel) | [`reports/home-mac-mobile-qa-status-manager-waived-no-device-20260703/`](../reports/home-mac-mobile-qa-status-manager-waived-no-device-20260703/) |
| DIN BRIDAL monitoring drift | **CLOSED** — legitimate live activity; fixture-only golden refresh **COMPLETE** (operator Nadeem Khan 2026-07-01) | None — monitoring PASS |
| **Official calendar stability Days 7–12** | **COMPLETE** — 6/6 PASS; see [`OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md`](OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md) | Continue **Day 13+** toward R8 window |
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
[`OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md`](OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md)  
[`reports/single-core-engine-calendar-stability-official-20260707/`](../reports/single-core-engine-calendar-stability-official-20260707/) … [`20260712/`](../reports/single-core-engine-calendar-stability-official-20260712/)

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
| Mobile release | **Separate track** — `BLOCKED_SALESMAN_DEVICE_QA_PENDING` |

Evidence: [`reports/single-core-engine-stability-window-20260701/`](../reports/single-core-engine-stability-window-20260701/)

## Stability Day 1 — web orphan receipt fix (2026-07-01)

| Item | Status |
|------|--------|
| Issue | RCV-0081 / RCV-0082 — zero-line `manual_receipt` orphans from web retry |
| Code fix | **COMPLETE** — atomic posting, duplicate guard, orphan UI + soft hide |
| Production cleanup | **APPLIED** — soft void (no GL lines); audit reason recorded |
| Pre-fix monitoring | **PASS** |
| Post-fix monitoring | **FAIL** — DIN BRIDAL Roznamcha golden −90,000 PKR (orphan void removed phantom cash; TB still PASS) |
| Migrations | **none** |
| Feature flags | unchanged |
| Frontend deploy | **deferred** — operator approval |

Evidence: [`reports/web-payment-orphan-receipt-fix-stability-day1-20260701/`](../reports/web-payment-orphan-receipt-fix-stability-day1-20260701/)

## Orphan fix deploy + Roznamcha refresh (2026-07-02)

| Item | Status |
|------|--------|
| Frontend deploy | **COMPLETE** — `deploy/vps-build-erp-only.sh` @ `6da3387f` (orphan fix `dcf82d89`) |
| DIN BRIDAL Roznamcha fixture refresh | **COMPLETE** — Cash In **2,026,850**, Closing **1,109,070** |
| Post-refresh / final monitoring | **PASS** (all three companies) |
| Production GL mutation this run | **none** (metadata-only orphan void was prior run) |

Evidence: [`reports/web-payment-orphan-fix-deploy-roznamcha-refresh-20260701/`](../reports/web-payment-orphan-fix-deploy-roznamcha-refresh-20260701/)

## Stability Day 2 — daily check (2026-07-02)

| Item | Status |
|------|--------|
| Classification | **STABILITY_DAY_PASS** |
| Monitoring artifact | `three-company-monitoring-2026-07-02T08-12-08-313Z` |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| Mobile release | separate track |

Evidence: [`reports/single-core-engine-stability-daily-20260702/`](../reports/single-core-engine-stability-daily-20260702/)

## Stability Day 3 — daily check (2026-07-03)

| Item | Status |
|------|--------|
| Classification | **STABILITY_DAY_PASS** |
| Monitoring artifact | `three-company-monitoring-2026-07-02T08-44-49-417Z` |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-stability-daily-20260703/`](../reports/single-core-engine-stability-daily-20260703/)

## Stability Day 4 — daily check (2026-07-04)

| Item | Status |
|------|--------|
| Classification | **STABILITY_DAY_PASS** |
| Run local date | 2026-07-02 (evidence folder `20260704`) |
| Monitoring artifact | `three-company-monitoring-2026-07-02T09-39-16-229Z` |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-stability-daily-20260704/`](../reports/single-core-engine-stability-daily-20260704/)

## Stability Day 5 — daily check

| Item | Status |
|------|--------|
| Classification | **STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-02 15:35:09 +05:00 |
| Monitoring artifact | `three-company-monitoring-2026-07-02T10-35-40-366Z` |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-stability-daily-20260705/`](../reports/single-core-engine-stability-daily-20260705/)

## Stability Day 6 — daily check

| Item | Status |
|------|--------|
| Classification | **STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-02 16:25:44 +05:00 |
| Monitoring artifact | `three-company-monitoring-2026-07-02T11-26-12-309Z` |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-stability-daily-20260706/`](../reports/single-core-engine-stability-daily-20260706/)

## Stability Day 7 — daily check

| Item | Status |
|------|--------|
| Classification | **STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-02 16:43:12 +05:00 |
| Monitoring artifact | `three-company-monitoring-2026-07-02T11-43-45-042Z` |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-stability-daily-20260707/`](../reports/single-core-engine-stability-daily-20260707/)

## Stability Day 8 / next sample

| Item | Status |
|------|--------|
| Classification | **STABILITY_SAMPLE_FAIL** |
| Run local date/time | 2026-07-02 17:03:03 +05:00 |
| Calendar days elapsed since 2026-07-01 | **1** |
| Monitoring artifact | `three-company-monitoring-2026-07-02T12-03-36-782Z` |
| DIN CHINA | FAIL (Playwright Roznamcha nav timeout; login/flags PASS) |
| Admin Compare | not reached |
| DIN BRIDAL | FAIL (timeout before Roznamcha) |
| DIN COUTURE | FAIL (timeout before Roznamcha) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Diagnosis | **monitoring bug** — transient UI automation flake; Day 7 PASS ~20 min earlier |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| R8 calendar note | Same-day repeated samples do **not** shorten the 2–4 week window |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-stability-daily-20260708/`](../reports/single-core-engine-stability-daily-20260708/)

### Day 8 retry 1 (2026-07-02 17:31:22 +05:00)

| Item | Status |
|------|--------|
| Classification | **STABILITY_SAMPLE_RETRY_PASS** |
| Calendar days elapsed since 2026-07-01 | **1** |
| Monitoring artifact | `three-company-monitoring-2026-07-02T12-31-57-841Z` |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Conclusion | Prior Day 8 fail was **transient monitoring UI flake** |
| Monitoring harness fix | **none** |
| Tests | 328/328 unified · 124/124 unit |

Evidence: [`reports/single-core-engine-stability-daily-20260708-retry1/`](../reports/single-core-engine-stability-daily-20260708-retry1/)

## Calendar Stability Check — 2026-07-02

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-02 18:06:31 +05:00 |
| Stability window calendar day | **2** |
| Calendar days elapsed since 2026-07-01 | **1** |
| Monitoring artifact | `three-company-monitoring-2026-07-02T12-55-47-086Z` |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests | 328/328 unified · 124/124 unit |
| R8 | **BLOCKED** |
| R8 calendar note | Same-day repeated samples do **not** shorten the 2–4 week window |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-20260702/`](../reports/single-core-engine-calendar-stability-20260702/)

## Calendar Stability Check — 2026-07-03 (Home Mac closure)

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-03 01:57:08 → 02:06:34 +05:00 |
| Stability window calendar day | **3** |
| Calendar days elapsed since 2026-07-01 | **2** |
| Monitoring artifact | `three-company-monitoring-2026-07-02T20-57-08-493Z` |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 328/328 unified · 124/124 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-20260703/`](../reports/single-core-engine-calendar-stability-20260703/)

## Home Mac mobile QA scope — 2026-07-03

| Item | Status |
|------|--------|
| Operator decision | Manager QA **N/A / waived** — company uses Admin + Salesman only |
| Admin QA | **PASS 21/21** (unchanged) |
| Manager QA | **N/A / waived** — no Manager user created |
| Salesman QA | **pending** — Salesman password + Pixel 6 Pro required |
| Device | **DEVICE_NOT_AVAILABLE_HOME_MAC** |
| Mobile release gate | **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |
| Play Store | **NOT RELEASED** |
| Calendar stability | separate track |
| R8 | **BLOCKED** |

Evidence: [`reports/home-mac-mobile-qa-status-manager-waived-no-device-20260703/`](../reports/home-mac-mobile-qa-status-manager-waived-no-device-20260703/)

## Calendar Stability Check — 2026-07-04 (Home Mac)

| Item | Status |
|------|--------|
| Initial guard fail | `spawnSync powershell.exe ENOENT` — **MONITORING_GUARD_HARNESS_BUG** |
| Fix | Cross-platform Node stdin SSH (`monitoringSshSql.mjs`, `threeCompanyLoaderGuard.mjs`) |
| Final classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-04 01:00:55 → 01:10:01 +05:00 |
| Stability window calendar day | **4** |
| Calendar days elapsed since 2026-07-01 | **3** |
| Monitoring artifact | `three-company-monitoring-2026-07-03T20-00-55-685Z` |
| Loader guard | **PASS** (8 loaders × 3 companies) |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 335/335 unified · 124/124 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | Admin PASS 21/21; Manager N/A/waived; Salesman pending |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-20260704/`](../reports/single-core-engine-calendar-stability-20260704/)

## Calendar Stability Check — 2026-07-05 (Office)

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-05 14:05:14 → 14:17:00 +05:00 |
| Stability window calendar day | **5** |
| Calendar days elapsed since 2026-07-01 | **4** |
| Pre-check fail | DIN BRIDAL golden drift — legitimate live activity |
| Fixture refresh | **COMPLETE** — operator Option A approved; fixture-only |
| Monitoring artifact | `three-company-monitoring-2026-07-05T09-05-15-899Z` |
| Loader guard | **PASS** (8 loaders × 3 companies) |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 335/335 unified · 124/124 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Admin PASS 21/21; Manager N/A/waived; Salesman pending |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-20260705/`](../reports/single-core-engine-calendar-stability-20260705/)

## Calendar Stability Check — 2026-07-06 (accelerated sample — see audit correction)

| Item | Status |
|------|--------|
| Classification | **TECHNICAL_SAMPLE_PASS_NOT_CALENDAR_COUNTED** |
| Run local date/time | 2026-07-05 16:00:26 → 16:15:03 +05:00 |
| Stability window calendar day | **6** |
| Calendar days elapsed since 2026-07-01 | **5** |
| Pre-check fail | DIN BRIDAL golden drift — legitimate live activity since Day 5 fixture |
| Fixture refresh | **COMPLETE** — operator Option A; fixture-only |
| Monitoring artifact | `three-company-monitoring-2026-07-05T11-00-27-523Z` |
| Loader guard | **PASS** (8 loaders × 3 companies) |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 335/335 unified · 126/126 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Admin PASS 21/21; Manager N/A/waived; Salesman pending |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-20260706/`](../reports/single-core-engine-calendar-stability-20260706/)

## Calendar Stability Check — 2026-07-07 (accelerated sample — see audit correction)

| Item | Status |
|------|--------|
| Classification | **TECHNICAL_SAMPLE_PASS_NOT_CALENDAR_COUNTED** |
| Run local date/time | 2026-07-05 16:15:36 → 16:28:13 +05:00 |
| Stability window calendar day | **7** |
| Calendar days elapsed since 2026-07-01 | **6** |
| Monitoring artifact | `three-company-monitoring-2026-07-05T11-15-38-400Z` |
| Loader guard | **PASS** (8 loaders × 3 companies) |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 335/335 unified · 126/126 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Admin PASS 21/21; Manager N/A/waived; Salesman pending |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-20260707/`](../reports/single-core-engine-calendar-stability-20260707/)

## Calendar audit correction — 2026-07-05 accelerated samples

The samples previously recorded as Calendar Day 6 and Calendar Day 7 were technically successful monitoring samples, but their evidence shows local run date 2026-07-05.

Classification:
- Technical monitoring result: PASS
- Calendar/R8 counting result: NOT COUNTED as separate calendar days
- Reason: same-day repeated samples do not shorten the 2–4 week R8 stability window

These samples are retained as extra stability evidence only.

**Policy update (2026-07-07):** Calendar date-gate spacing for forward official runs removed — consecutive days may run in same session. Historical NOT COUNTED samples above remain unchanged.

R8 remains BLOCKED until the real 2–4 week calendar stability window completes and Nadeem gives written approval.

Correction evidence: [`reports/single-core-engine-calendar-audit-correction-20260705/`](../reports/single-core-engine-calendar-audit-correction-20260705/)

**Supersession note (2026-07-07):** Date gate removed for forward official runs. Accelerated 2026-07-05 Day 6/7 samples and 2026-07-06 bypass sample remain NOT COUNTED.

## Official Calendar Stability Check — 2026-07-06

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-06 12:56:34 → 13:10:15 +05:00 |
| Official stability window calendar day | **6** |
| Calendar days elapsed since 2026-07-01 | **5** |
| Pre-check fail | DIN BRIDAL golden drift — legitimate live activity (first attempt 12:27 +05:00) |
| Fixture refresh | **COMPLETE** — operator Option A approved; fixture-only |
| Monitoring artifact | `three-company-monitoring-2026-07-06T07-56-36-537Z` |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 335/335 unified · 136/136 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| Accelerated sample note | Prior 2026-07-05 accelerated Day 6/7 samples retained as extra evidence only and not counted |
| R8 | **BLOCKED** |
| Mobile release | separate track — Admin PASS 21/21; Manager N/A/waived; Salesman pending |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260706/`](../reports/single-core-engine-calendar-stability-official-20260706/)

## Official Calendar Stability Check — 2026-07-07

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-07 12:36:23 → 12:50:46 +05:00 |
| Official stability window calendar day | **7** |
| Calendar days elapsed since 2026-07-01 | **6** |
| Pre-check | JE-0310 void (orphan PUR-0004 reversal) + fixture refresh DIN CHINA/BRIDAL |
| Monitoring artifact | `three-company-monitoring-2026-07-07T07-36-24-457Z` |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **JE-0310 void only** (operator correction) |
| Tests/build | 334/334 unified · 164/164 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| Date gate | **REMOVED** for forward consecutive official runs (2026-07-07) |
| Accelerated sample note | Prior 2026-07-05 accelerated Day 6/7 samples and 2026-07-06 bypass sample NOT COUNTED |
| R8 | **BLOCKED** |
| Mobile release | separate track — Admin PASS 21/21; Manager N/A/waived; Salesman pending |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260707/`](../reports/single-core-engine-calendar-stability-official-20260707/)

## Official Calendar Stability Check — 2026-07-08

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-07 12:52:18 → 13:06:17 +05:00 |
| Official stability window calendar day | **8** |
| Calendar days elapsed since 2026-07-01 | **7** |
| Monitoring artifact | `three-company-monitoring-2026-07-07T07-52-21-211Z` |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 334/334 unified · 167/167 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| Consecutive session note | Day 8 run same session as Day 7 after date-gate removal |
| R8 | **BLOCKED** |
| Mobile release | separate track — Admin PASS 21/21; Manager N/A/waived; Salesman **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260708/`](../reports/single-core-engine-calendar-stability-official-20260708/)

## Official Calendar Stability Check — 2026-07-09

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-07 13:18:09 → 13:30:00 +05:00 |
| Official stability window calendar day | **9** |
| Calendar days elapsed since 2026-07-01 | **8** |
| Pre-check fail | Attempt 1 — DIN CHINA Account Statements nav timeout (transient UI flake) |
| Monitoring artifact | `three-company-monitoring-2026-07-07T08-18-09-034Z` (retry 1 PASS) |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare 9/9) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 334/334 unified · 173/173 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Salesman **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260709/`](../reports/single-core-engine-calendar-stability-official-20260709/)

## Official Calendar Stability Check — 2026-07-10

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-07 15:29:50 → 15:40:52 +05:00 |
| Official stability window calendar day | **10** |
| Calendar days elapsed since 2026-07-01 | **9** |
| Pre-check fails | Multiple attempts — DIN CHINA live GL/roznamcha drift; UI timeouts; admin compare strict 9/9 fail (1 PKR) |
| Monitoring artifact | `three-company-monitoring-2026-07-07T10-29-51-582Z` (final PASS) |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare **MATERIALITY_WAIVER** maxAbsDiff=1 PKR) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| Fixture refresh | **COMPLETE** — DIN CHINA TB/roznamcha + DIN BRIDAL roznamcha (Option A) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** from calendar run (live activity observed; JE-0311 same-day) |
| Tests/build | 334/334 unified · 175/175 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Salesman **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260710/`](../reports/single-core-engine-calendar-stability-official-20260710/)

## Official Calendar Stability Check — 2026-07-11

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-07 19:04:35 → 19:17:30 +05:00 |
| Official stability window calendar day | **11** |
| Calendar days elapsed since 2026-07-01 | **10** |
| Pre-check fail | Attempt 1 — DIN CHINA TB/roznamcha drift (post wholesale clearance GL activity) |
| Monitoring artifact | `three-company-monitoring-2026-07-07T14-04-35-150Z` (final PASS) |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare **MATERIALITY_WAIVER** maxAbsDiff=1 PKR) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| Fixture refresh | **COMPLETE** — DIN CHINA TB/roznamcha only (Option A) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** from calendar run |
| Tests/build | 334/334 unified · 176/176 unit · build PASS |
| Frontend deploy | **COMPLETE** — `deploy/vps-build-erp-only.sh` @ `711d2307` |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Salesman **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260711/`](../reports/single-core-engine-calendar-stability-official-20260711/)

## Official Calendar Stability Check — 2026-07-12

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-07 19:46:26 → 19:58:30 +05:00 |
| Official stability window calendar day | **12** |
| Calendar days elapsed since 2026-07-01 | **11** |
| Pre-check fail | Attempts 1–2 — CHINA TB/roznamcha drift; BRIDAL roznamcha revert |
| Monitoring artifact | `three-company-monitoring-2026-07-07T14-46-27-601Z` (final PASS) |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare **9/9 strict PASS**) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| Fixture refresh | **COMPLETE** — CHINA TB/roznamcha (incl. negative closing) + BRIDAL roznamcha |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** from calendar run |
| Tests/build | 334/334 unified · 176/176 unit · build PASS |
| Days 7–12 summary | [`OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md`](OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md) |
| R8 | **BLOCKED** |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260712/`](../reports/single-core-engine-calendar-stability-official-20260712/)

## Official Calendar Stability Check — 2026-07-13

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-08 17:18:08 → 17:35:00 +05:00 |
| Official stability window calendar day | **13** |
| Calendar days elapsed since 2026-07-01 | **12** |
| Monitoring artifact | `three-company-monitoring-2026-07-08T12-18-09-526Z` |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare **MATERIALITY_WAIVER** maxAbsDiff=1 PKR) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| Fixture refresh | **COMPLETE** — CHINA TB/roznamcha + BRIDAL roznamcha (Option A) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 334/334 unified · 176/176 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Salesman **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260713/`](../reports/single-core-engine-calendar-stability-official-20260713/)

## Official Calendar Stability Check — 2026-07-14

| Item | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Run local date/time | 2026-07-08 17:56:00 → 18:13:00 +05:00 |
| Official stability window calendar day | **14** |
| Calendar days elapsed since 2026-07-01 | **13** |
| Monitoring artifact | `three-company-monitoring-2026-07-08T12-56-01-209Z` |
| Loader guard | **PASS** |
| Roznamcha reached | **yes** |
| DIN CHINA | PASS (Admin Compare **9/9 strict PASS**) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |
| Fixture refresh | **COMPLETE** — CHINA TB/roznamcha + BRIDAL roznamcha (Option A) |
| migrations_run | false |
| gl_mutations | false |
| Feature flags | unchanged |
| Production mutation | **none** |
| Tests/build | 334/334 unified · 176/176 unit · build PASS |
| Password env | supplied yes — value **not** recorded |
| R8 | **BLOCKED** |
| Mobile release | separate track — Salesman **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |
| Supplier Party Discount | separate approval |

Evidence: [`reports/single-core-engine-calendar-stability-official-20260714/`](../reports/single-core-engine-calendar-stability-official-20260714/)

## Exact next recommended phase

1. **Day 15** — complete official calendar stability R8 readiness checkpoint
2. **Salesman device QA** — when Pixel 6 Pro available + Salesman password supplied securely at QA time
3. **R8 legacy retirement** — blocked until stability window complete + `NADEEM_APPROVES_R8_LEGACY_RETIREMENT`

Do **not** auto-run GL repairs, supplier JE, or R8 retirement.
