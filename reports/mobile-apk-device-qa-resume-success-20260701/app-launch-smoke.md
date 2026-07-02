# App launch smoke — MOBILE APK DEVICE QA RESUME

**Generated:** 2026-07-01  
**Status:** PARTIAL PASS

## Automated checks (Pixel 6 Pro)

| # | Check | Result |
|---|-------|--------|
| 1 | App opens | **PASS** — process active after launch |
| 2 | No crash | **PASS** — no `FATAL EXCEPTION` in logcat |
| 3 | Login screen | **NOT VERIFIED** — device lock screen blocked UI automation |
| 4 | No blank screen | **NOT VERIFIED** — unlock required |
| 5 | No chunk/import error | **PASS** |
| 6 | Backend connectivity | **PASS** — `erp.dincouture.pk` / `supabase.dincouture.pk` ping from device |
| 7 | Close/reopen | **PASS** |
| 8 | Logout/login flow | **NOT VERIFIED** — operator must unlock device |

**Operator action:** Unlock Pixel 6 Pro and confirm login screen manually.
