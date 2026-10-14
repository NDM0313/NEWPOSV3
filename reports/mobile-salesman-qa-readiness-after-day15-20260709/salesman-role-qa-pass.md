# Salesman role QA — PASS (login)

**Date:** 2026-07-09  
**Classification:** `SALESMAN_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`  
**Attestation:** Operator Nadeem — Salesman login **PASS** on Pixel 6 Pro

## Device

| Field | Value |
|-------|--------|
| Device | Pixel 6 Pro (`24281FDEE0023P`) |
| Android | 16 |
| Package | `com.dincouture.erp` |
| versionName | 1.0.5 (39) |
| ADB | authorized |

## Result

| Check | Salesman |
|-------|----------|
| App opens | **PASS** |
| Login screen works | **PASS** |
| Login works | **PASS** (operator attested) |
| No crash on login path | **PASS** |
| No blank screen on login path | **PASS** |

Full read-only checklist (`device-qa-checklist.md` rows 4–20) may continue on device; **release gate for Salesman login is cleared**.

## Role matrix

| Role | Status |
|------|--------|
| Admin | PASS 21/21 (prior) |
| Manager | N/A / waived |
| Salesman | **PASS** (login) |
| Play Store | **NOT RELEASED** |

## Safety

- Password value recorded: **no**
- APK/AAB uploaded: **no**
- Play Store submission: **no**
- Manager user created: **no**
- Production GL mutation: **no**
