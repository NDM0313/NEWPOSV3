# ROLE_AND_RESOURCE_GATES.md

These are **not** product-code defects. Do not mark PASS.

| Gate | Status | Notes |
|------|--------|-------|
| Admin live RLS | VERIFIED_PASS (retained) | See `reports/mobile-single-core-final-closure-20260717/` |
| Three-company read-only parity | VERIFIED_PASS (retained) | 0 FAIL |
| Salesman live RLS | RESOURCE_GATED | Identity `noman@yahoo.com` verified; password env missing |
| Limited-user live RLS | RESOURCE_GATED | No active Limited user; Path A/B not approved |
| Branch-restricted live RLS | RESOURCE_GATED | No branch QA identity; salesmen have 0 `user_branches` |
| Emulator APK QA | DEVICE_GATED | `EMULATOR_ENVIRONMENT_UNAVAILABLE` |
| Physical device QA | DEVICE_GATED | `NOT_RUN_DEVICE_GATED` |
| Temp QA users | APPROVAL_GATED | Needs `APPROVE_CREATE_TEMP_MOBILE_QA_USERS` |
| Formal role N/A | APPROVAL_GATED | Needs `APPROVE_MOBILE_QA_ROLE_GATES_NOT_APPLICABLE` |
| Merge | APPROVAL_GATED | Needs `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE` |
| Play Store | RELEASE_GATED | Separate explicit release approval |

Client-side role report gates: **ENGINEERING_COMPLETE** (unit coverage green).
