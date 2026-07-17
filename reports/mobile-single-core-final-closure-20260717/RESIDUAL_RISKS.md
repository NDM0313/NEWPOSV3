# RESIDUAL_RISKS.md

1. Salesman live RLS blocked on missing password env vars.
2. Limited + branch QA identities unavailable until `APPROVE_CREATE_TEMP_MOBILE_QA_USERS` (see `TEMP_QA_USER_PLAN.md`).
3. Emulator ADB/AVD remains unreliable for authenticated APK matrix.
4. No authorized physical device attached.
5. Salesmen currently have zero `user_branches` rows — branch-scope semantics for Salesman need explicit policy confirmation during live RLS.
