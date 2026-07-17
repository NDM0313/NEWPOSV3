## Title

`feat(mobile): complete Single Core reporting alignment`

## Decision gate

Neither `APPROVE_CREATE_TEMP_MOBILE_QA_USERS` nor `APPROVE_MOBILE_QA_ROLE_GATES_NOT_APPLICABLE` was supplied. Temp-user plan remains unexecuted. Limited/branch remain `QA_IDENTITY_NOT_AVAILABLE` (not formal N/A).

## Remaining blockers

- Salesman password env missing
- Physical device not connected
- Emulator: system ANR / login FAIL (`EMULATOR_ENVIRONMENT_UNAVAILABLE`)

## Green retained

Parity 0 FAIL · Admin RLS PASS · Tests 89/350 · APK SHA `d15114fc…` · Mutations NONE

## Merge readiness

`NOT_READY_FOR_MERGE`

Merge requires separate: `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`
