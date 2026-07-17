# RESIDUAL_RISKS.md

1. **Salesman / limited / branch-restricted live RLS** not exercised — credentials not in approved local env (`NOT_RUN_CREDENTIAL_GATED`).
2. **Physical device QA** not run — no authorized device attached.
3. **Emulator APK authenticated matrix** incomplete — WebView blocks UiAutomator/adb automation (`EMULATOR_QA_FAIL`). Mobile web QA on same bundle partially mitigates.
4. **Contact-list vs period statement closing** — documented `EXPECTED_BASIS_DIFFERENCE`; must stay labelled in UI.
5. **Aging operational vs official GL** — documented expected basis difference.
6. **Some edit/void/return/rental paths** may still rely on realtime/UI refresh rather than central invalidation helper.
7. **Dirty `main` WIP** exists separately — merge only from feature branch, never over dirty main.
