# RESIDUAL_RISKS.md

1. Salesman live RLS unproven — set `QA_BROWSER_EMAIL_SALESMAN` + `QA_BROWSER_PASSWORD_SALESMAN` (verified candidate: `noman@yahoo.com` / DIN BRIDAL / role `salesman`).
2. Limited and branch-restricted live RLS unproven — credentials not in approved env.
3. Authenticated APK emulator matrix incomplete — AVD instability; use stable emulator + `mobile-single-core-emulator-ws-cdp-qa.mjs`.
4. Physical device QA not run.
5. Contact-list vs statement basis difference remains documented expected behaviour.
