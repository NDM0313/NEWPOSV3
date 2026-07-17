# RELEASE_READINESS.md

**Merge readiness:** `READY_FOR_REVIEW` (not READY_TO_MERGE)

Blocked for PASS verdict / production release:
- Live web↔mobile parity credentials
- Emulator + authorized device QA
- Signed release / store upload
- Explicit merge approval to `main`

Code/automation gates for this branch: tests + typecheck + prod build + debug APK OK.
