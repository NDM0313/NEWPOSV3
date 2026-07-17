# FINAL_REPORT.md

## Verdict

`MOBILE_SINGLE_CORE_DECISION_GATE_PARTIAL`

## Decision paths

| Path | Status |
|------|--------|
| A — Create temp QA users | **Blocked** — phrase not supplied |
| B — Formal role N/A | **Blocked** — phrase not supplied |
| Merge | **Blocked** — phrase not supplied |

## Live gates

| Gate | Status |
|------|--------|
| Salesman RLS | `NOT_RUN_CREDENTIAL_GATED` |
| Limited | `QA_IDENTITY_NOT_AVAILABLE` |
| Branch-restricted | `QA_IDENTITY_NOT_AVAILABLE` |
| Emulator APK | `EMULATOR_QA_FAIL` / `EMULATOR_ENVIRONMENT_UNAVAILABLE` |
| Physical device | `NOT_RUN_DEVICE_GATED` |

## Still green

89/350 tests, typecheck/build, three-company parity, admin RLS, APK `93cd8436` / SHA `d15114fc…`, mutations/migrations/4100/R8-R2: **NONE**. Product defects: **0**.

## Merge readiness

`NOT_READY_FOR_MERGE`

See `DECISION_GATE.md` for operator unblock choices.
