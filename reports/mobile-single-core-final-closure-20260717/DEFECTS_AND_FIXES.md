# DEFECTS_AND_FIXES.md

Generated: 2026-07-17 (operational gates)

| Finding | Product defect? | Action |
|---------|-----------------|--------|
| Salesman password missing from approved env | No | `NOT_RUN_CREDENTIAL_GATED` |
| No limited/easy active role users in production | No (identity inventory) | `NOT_RUN_CREDENTIAL_GATED` — do not create users without approval |
| No credentialed branch-restricted non-admin QA identity | No | `NOT_RUN_CREDENTIAL_GATED` |
| Emulator offline / ADB hang after cold boot | No (Android/AVD) | `EMULATOR_QA_FAIL` |
| No physical device attached | No | `NOT_RUN_DEVICE_GATED` |

**Product-code fixes this run:** NONE
