# Secure credential plan — Manager / Salesman mobile QA

**Run local date/time:** 2026-07-02 19:32:18 +05:00  
**No passwords recorded. No credentials committed.**

## Manager QA account

| Field | Value |
|-------|-------|
| Email placeholder | *(operator to provide — none in approved local source)* |
| Role | Manager |
| Target company | **DIN BRIDAL** (recommended — Admin QA goldens + primary mobile parity target) |
| Target branch | Operator to confirm (HQ or assigned branch) |
| Expected permissions | Reports Hub; BS/P&L/TB/Cash Flow/Ledger read-only; operational modules per RBAC; no Admin-only settings |
| Expected restrictions | No GL repair/dev/flag tools; no user management; no production write outside allowed mobile scope |
| Account exists (DB) | **no** — zero `manager` role users across DIN CHINA / BRIDAL / COUTURE |
| Password in approved secure source | **no** |
| PIN required | **unknown** (mobile supports counter PIN — confirm per account) |
| Creation required | **yes** (unless operator designates an existing non-manager account to promote — separate approval) |

## Salesman QA account

| Field | Value |
|-------|-------|
| Email placeholder | *(operator to provide — e.g. masked candidate `no***@yahoo.com` Noman Ali, DIN BRIDAL)* |
| Role | Salesman |
| Target company | **DIN BRIDAL** (recommended for parity with Admin QA company) |
| Target branch | Operator to confirm assigned branch |
| Expected permissions | Home/POS or sales entry; scoped sales/customer modules; read-only reports if policy allows |
| Expected restrictions | No admin accounting; no Manager/Admin reports; no GL/dev/R8 tools |
| Account exists (DB) | **yes** — 7 active salesman accounts with auth link (see discovery) |
| Password in approved secure source | **no** |
| PIN required | **unknown** |
| Creation required | **no** (existing accounts usable once operator provides password securely) |

## Approved secure delivery methods

1. Operator verbal / secure note at QA time (not committed)
2. Password manager share to tester only
3. Manual entry on device during QA session
4. Local uncommitted `.env` **only** if operator adds `QA_MOBILE_MANAGER_*` / `QA_MOBILE_SALESMAN_*` vars and confirms they will never be committed

**Do not** commit `.env`, passwords, or keystore material.
