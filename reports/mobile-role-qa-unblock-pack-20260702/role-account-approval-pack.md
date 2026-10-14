# Role account approval pack

**Run local date/time:** 2026-07-02 19:32:18 +05:00  
**No user creation performed.**

## Recommended path

| Role | Recommended option | Rationale |
|------|-------------------|-----------|
| Manager | **Option B** (temporary QA user) **or** promote existing user with explicit approval | Zero `manager` role users in production DB |
| Salesman | **Option A** (existing account + operator password) | 7 active salesman accounts with auth links |

---

## Option A — Use existing production accounts

**Requires:** Operator provides credentials securely at QA time. No user creation.

### Salesman (ready)
- Pick one **active DIN BRIDAL** salesman (e.g. Noman Ali — `no***@yahoo.com`).
- Operator provides password (+ PIN if enrolled) out-of-band.
- Tester logs in on Pixel 6 Pro; run scoping QA checklist.

### Manager (blocked without account)
- No `manager` role user exists. Option A only applies if operator:
  - promotes an existing user to `manager` with written approval, **or**
  - confirms a different role label should be used for Manager QA (document exception).

**GL/data mutation:** none if login-only QA.

---

## Option B — Create temporary QA role accounts

**Requires explicit written operator approval before execution.**

| Step | Manager QA user | Salesman QA user |
|------|-----------------|------------------|
| Create auth + public.users row | yes | only if no existing account chosen |
| Role | `manager` | `salesman` |
| Company | DIN BRIDAL | DIN BRIDAL |
| Branch | operator-assigned | operator-assigned |
| Permissions | standard manager RBAC | standard salesman RBAC |
| Password | set out-of-band; never commit | set out-of-band; never commit |
| Cleanup after QA | disable or delete QA users per operator plan | disable only if temp account created |

**Constraints:** No GL mutation. No feature flag changes. No monitoring fixture refresh.

---

## Option C — Defer mobile role QA

- Keep release gate: **BLOCKED_PARTIAL_DEVICE_QA_PENDING_ROLES**
- Admin QA PASS 21/21 remains valid.
- Play Store remains **NOT RELEASED**.
- Continue Single Core calendar stability separately.

---

## Operator decision needed

1. Approve **Option A** for Salesman (name which account).
2. Choose **Option B** or promote path for Manager.
3. Connect Pixel 6 Pro via USB (see device reconnect checklist).
4. Provide passwords manually at QA session — never via git.
