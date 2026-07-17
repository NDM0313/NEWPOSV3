## Title

`feat(mobile): complete Single Core reporting alignment`

## Summary

- Three-company live parity: **0 FAIL**
- Admin RLS: **PASS**
- Salesman / Limited / Branch live RLS: **`NOT_RUN_CREDENTIAL_GATED`**
- Emulator authenticated APK: **`EMULATOR_QA_FAIL`** (AVD/ADB offline)
- Physical device: **`NOT_RUN_DEVICE_GATED`**
- Tests: mobile 89 · unified 350 · typecheck/build PASS
- APK: product `93cd8436` · SHA `d15114fc…` · 1.0.5 / 39
- Mutations / migrations / 4100 / R8-R2: **NONE**

## Merge recommendation

`NOT_READY_FOR_MERGE`

Unblock by providing salesman (and limited/branch if available) passwords in approved env, running authenticated APK QA on a stable emulator or device, then supply:

`APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`
