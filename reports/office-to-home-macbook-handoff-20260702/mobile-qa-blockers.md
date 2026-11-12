# Mobile QA blockers — 2026-07-02 handoff

**Release gate:** `BLOCKED_PARTIAL_DEVICE_QA_PENDING_ROLES`  
**Play Store:** NOT RELEASED

## Blockers

| Blocker | Detail |
|---------|--------|
| Manager user | **0** manager users in DB. Temp create blocked: `MANAGER_QA_EMAIL` was placeholder `<PUT_OPERATOR_CONTROLLED_EMAIL_HERE>`. Evidence: `reports/create-temp-manager-qa-user-apply-20260702/` |
| Salesman password | Active salesman accounts exist (recommended: **Noman Ali** / `no***@yahoo.com` / DIN BRIDAL). Password not available in repo — operator must provide securely. |
| ADB device | Pixel 6 Pro **not connected** at office handoff. No `adb devices` entry. |
| Role device QA | Manager/Salesman on-device QA **not started** — waiting on credentials + device. |

## Ready / complete

| Item | Status |
|------|--------|
| Admin mobile QA | **PASS** 21/21 (prior run) |
| Unblock pack | Complete — `fbfb5fbe` |
| Manager create path | `create-erp-user` edge function — no migration |
| Target package | `com.dincouture.erp` v1.0.5 / versionCode 39 |

## Manager creation plan (when unblocked)

- Role: `manager`
- Company: DIN BRIDAL — `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`
- Path: `supabase/functions/create-erp-user/index.ts` or equivalent service
- Branch: Main Branch / HQ — `cc920703-97a0-43a4-95d4-9262996c2af7`
- Display name: Mobile QA Manager
- Email: operator-controlled (real inbox)
- Password: secure keyboard entry only — never in git/chat/logs
