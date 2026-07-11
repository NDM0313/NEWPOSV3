# Mobile Salesman QA Status â€” Office

**Date:** 2026-07-11
**Final status:** `SALESMAN_EXTENDED_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`

## Repo

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD (pre-closeout) | `511044a1` |
| origin/main (pre-closeout) | `511044a1` |
| Closeout baseline | `96890d0a` present in history |
| Salesman QA pass commit | `44154031` (2026-07-09 office) |

## ADB / Device

| Item | Value |
|------|--------|
| adb installed | **yes** (`/usr/local/bin/adb`) |
| adb version | Android Debug Bridge 1.0.41 / platform-tools 37.0.0-14910828 |
| adb devices result (2026-07-11) | `24281FDEE0023P device` (QA sessions) |
| Pixel status (2026-07-11) | **connected** â€” extended QA signed off |
| Pixel status (2026-07-09 office) | **PASS** â€” login path (`24281FDEE0023P`) |

## Salesman QA

| Item | Value |
|------|--------|
| Password requested | **no** |
| QA run (2026-07-11) | **yes** â€” rows 4â€“20 signed off |
| QA run (2026-07-09 office) | **yes** â€” rows 1â€“3 login path |
| Result | **PASS** â€” `SALESMAN_EXTENDED_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED` |
| Runbook used | `reports/mobile-manager-salesman-device-qa-20260702/salesman-role-qa.md`, `docs/mobile_phase3_device_qa_runbook.md` |
| Evidence | [`salesman-role-qa-pass.md`](salesman-role-qa-pass.md), [`office-pixel-salesman-qa-session.md`](office-pixel-salesman-qa-session.md) |

### Key checks (2026-07-09 office session)

| Check | Result |
|-------|--------|
| Login | **PASS** (operator attested on Pixel 6 Pro) |
| Role scope | login gate cleared; full checklist rows 4â€“20 optional extended QA |
| Branch/customer/data access | not re-verified 2026-07-10 (no device) |
| Admin controls hidden | not re-verified 2026-07-10 (no device) |
| Reports/ledger permissions | not re-verified 2026-07-10 (no device) |
| Crash status | **PASS** â€” no FATAL on launch/login path (2026-07-09) |

## Mobile release

| Item | Status |
|------|--------|
| Manager QA | N/A / waived |
| Play Store | **NOT RELEASED** |
| APK/AAB uploaded | **no** |

## Safety

| Gate | Result |
|------|--------|
| R8 run | no |
| DB migrations run | no |
| Repairs run | no |
| Production GL/data mutation | no |
| Passwords committed | no |
| Sensitive/unrelated files staged | no |

## 2026-07-11 extended QA session (rows 4â€“20) â€” SIGNED OFF

| Item | Value |
|------|--------|
| Pixel | `24281FDEE0023P` (sessions during day) |
| Password requested | **no** |
| Rows 4â€“20 | **PASS** (9) + **N/A** (7) â€” operator: app proper working |
| Classification | `SALESMAN_EXTENDED_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED` |
| Validation | monitoring PASS, 336/336 unified, 183/183 unit, build PASS |
| Evidence | `reports/salesman-extended-qa-pixel-rows-4-20-20260711/` |

Login gate (rows 1â€“3) remains **PASS** from 2026-07-09. Full extended checklist **complete** for mobile release-readiness (Play Store upload still separately gated).
