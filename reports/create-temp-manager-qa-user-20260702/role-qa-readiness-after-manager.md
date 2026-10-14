# Role QA readiness after Manager prep

**Run local date/time:** 2026-07-02 19:54:54 +05:00

| Track | Classification |
|-------|----------------|
| Manager | `ROLE_QA_BLOCKED_CREDENTIALS` — user not created; email + password needed |
| Salesman | `ROLE_QA_BLOCKED_SALESMAN_PASSWORD` — existing accounts; password not in approved source |
| Device | `ROLE_QA_BLOCKED_DEVICE` — adb empty |
| Full role QA | **not run** |

Admin QA PASS 21/21 unchanged.

## Operator inputs needed to proceed

1. **Exact Manager QA email** (e.g. `mobile.manager.qa+20260702@yourdomain.com`).
2. **Manager password** — provided securely at creation/QA time only.
3. **Salesman password** for chosen account (e.g. Noman Ali).
4. **Pixel 6 Pro** connected via adb (`device` state).
