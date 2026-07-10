# Mobile Salesman QA Status — Office

**Date:** 2026-07-10  
**Final status:** `SALESMAN_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`

## Repo

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD | `e23cbcab` |
| origin/main | `e23cbcab` |
| Closeout baseline | `96890d0a` present in history |
| Salesman QA pass commit | `44154031` (2026-07-09 office) |

## ADB / Device

| Item | Value |
|------|--------|
| adb installed | **yes** (`/usr/local/bin/adb`) |
| adb version | Android Debug Bridge 1.0.41 / platform-tools 37.0.0-14910828 |
| adb devices result (2026-07-10) | *(empty — no devices attached)* |
| Pixel status (2026-07-10) | **not connected** — cannot re-run QA this session |
| Pixel status (2026-07-09 office) | **PASS** — Pixel 6 Pro `24281FDEE0023P` authorized |

## Salesman QA

| Item | Value |
|------|--------|
| Password requested (2026-07-10) | no — device gate blocks re-run |
| Password value recorded | **no** |
| QA run (2026-07-10) | **no** — Pixel not connected |
| QA run (2026-07-09 office) | **yes** — login path verified |
| Result | **PASS** (login) — `SALESMAN_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED` |
| Runbook used | `reports/mobile-manager-salesman-device-qa-20260702/salesman-role-qa.md`, `docs/mobile_phase3_device_qa_runbook.md` |
| Evidence | [`salesman-role-qa-pass.md`](salesman-role-qa-pass.md), [`office-pixel-salesman-qa-session.md`](office-pixel-salesman-qa-session.md) |

### Key checks (2026-07-09 office session)

| Check | Result |
|-------|--------|
| Login | **PASS** (operator attested on Pixel 6 Pro) |
| Role scope | login gate cleared; full checklist rows 4–20 optional extended QA |
| Branch/customer/data access | not re-verified 2026-07-10 (no device) |
| Admin controls hidden | not re-verified 2026-07-10 (no device) |
| Reports/ledger permissions | not re-verified 2026-07-10 (no device) |
| Crash status | **PASS** — no FATAL on launch/login path (2026-07-09) |

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

## 2026-07-10 session note

Repo synced; ADB installed; Pixel 6 Pro not connected. Salesman mobile QA **release gate remains PASS** from 2026-07-09 office evidence. To extend full device checklist (rows 4–20), reconnect Pixel, authorize USB debugging, and re-run on device.
