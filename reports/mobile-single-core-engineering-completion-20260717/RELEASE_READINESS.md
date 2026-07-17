# RELEASE_READINESS.md

| Item | Status |
|------|--------|
| Engineering Single Core reporting | COMPLETE |
| Debug APK rebuild after this phase | Required (in progress / recorded in APK_INTEGRITY.md) |
| Unsigned release APK/AAB | Supported when `keystore.properties` absent (`signingConfig` omitted) — RELEASE_GATED for store |
| Production signed artifacts | RELEASE_GATED — requires keystore + separate approval |
| Play Store upload | RELEASE_GATED |
| Merge to main | APPROVAL_GATED |
| Live Salesman/Limited/branch RLS | RESOURCE_GATED |
| Physical device QA | DEVICE_GATED |

## Honest merge readiness

`ENGINEERING_COMPLETE_AWAITING_RESOURCES`

Not `READY_FOR_APPROVAL` until Salesman RLS + physical device (and Limited/branch PASS or formal Path B N/A).
