# RESIDUAL_RISKS.md

1. **Salesman live RLS** blocked until `QA_BROWSER_EMAIL_SALESMAN` + `QA_BROWSER_PASSWORD_SALESMAN` are set for verified `noman@yahoo.com` (or another approved salesman).
2. **Limited live RLS** blocked — no active limited/easy role users in production inventory; credentials also missing.
3. **Branch-restricted live RLS** blocked — no approved credentialed identity; salesmen currently have 0 `user_branches` rows.
4. **Authenticated APK emulator** blocked by AVD/ADB instability (`device offline`, shell hangs).
5. **Physical device QA** not run — no authorized device attached.
6. Contact-list vs period statement basis difference remains a documented expected difference (prior parity).
