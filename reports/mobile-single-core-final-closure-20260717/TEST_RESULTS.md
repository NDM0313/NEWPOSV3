# TEST_RESULTS.md

Generated: 2026-07-17 (operational gates)

| Suite / gate | Result |
|--------------|--------|
| Mobile tests (prior + retained) | 89 PASS / 0 FAIL |
| Unified Ledger | 350 PASS / 0 FAIL |
| Typecheck / production build | PASS (product commit `93cd8436`) |
| Three-company live parity | 0 FAIL |
| Admin live RLS (re-run) | **PASS** (own TB + cross-company ACCESS_DENIED) |
| Salesman live RLS | `NOT_RUN_CREDENTIAL_GATED` |
| Limited live RLS | `NOT_RUN_CREDENTIAL_GATED` |
| Branch-restricted live RLS | `NOT_RUN_CREDENTIAL_GATED` |
| Emulator authenticated APK | `EMULATOR_QA_FAIL` |
| Physical device | `NOT_RUN_DEVICE_GATED` |
| Mobile-web supplementary | 9/9 PASS (≠ APK) |
