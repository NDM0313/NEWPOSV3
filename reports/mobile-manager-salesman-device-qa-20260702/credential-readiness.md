# Credential readiness — Manager/Salesman device QA

**Run local date/time:** 2026-07-02 19:22:36 +05:00  
**Classification:** **MOBILE_ROLE_QA_BLOCKED_CREDENTIALS**

## Approved secure source check

Checked `erp-mobile-app/.env` for role QA variables only (names/ presence — **passwords not logged**).

| Role | Credential available | Notes |
|------|---------------------|-------|
| **Manager** | **no** | No `MANAGER_*` / mobile role QA env vars in approved local source |
| **Salesman** | **no** | No `SALESMAN_*` / mobile role QA env vars in approved local source |
| Admin (reference) | yes (prior run) | Admin manual QA PASS 21/21 on 2026-07-01 — not reused for Manager/Salesman |

Present in `.env` (monitoring / other QA only — **not** Manager/Salesman role accounts):
- Per-company browser monitoring emails/passwords (DIN CHINA / BRIDAL / COUTURE)
- Create-business OTP QA vars

## Expected role policy (from prior readiness pack)

| Role | Expected access |
|------|-----------------|
| Manager | Company dashboard; Reports Hub; BS/P&L/TB/Cash Flow/Ledger read-only; no Admin-only settings; branch/company scope per RBAC |
| Salesman | Home/POS or sales entry; permitted modules only; no admin accounting/GL/dev tools; read-only reports if visible per policy |

## Operator credential request

Provide **out-of-band** (do not commit):

1. **Manager** production login email + password for on-device QA (PIN if required).
2. **Salesman** production login email + password for on-device QA (PIN if required).
3. Confirm target **company** and **branch** for each role (e.g. DIN BRIDAL HQ).
4. Confirm whether test accounts already exist or operator approval is needed to create them.
5. Connect **Pixel 6 Pro** (or approved device) via USB with USB debugging authorized.

No users created. No credentials committed. No production mutation.
