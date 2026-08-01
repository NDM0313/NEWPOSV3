# Account state recheck (read-only)

**Run local date/time:** 2026-07-02 19:54:54 +05:00  
**Classification:** `READ_ONLY_RECHECK_OK` — no manager exists; creation may proceed once email + password supplied

## Manager users

| Scope | Count |
|-------|-------|
| All companies (`role=manager`) | **0** |
| DIN BRIDAL only | **0** |

**MANAGER_ACCOUNT_ALREADY_EXISTS:** **no** — safe to create when inputs ready.

## DIN BRIDAL company

| Field | Value |
|-------|-------|
| company_id | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` |

## Branches (DIN BRIDAL)

| Name | Code | branch_id | Active |
|------|------|-----------|--------|
| Main Branch | HQ | `cc920703-97a0-43a4-95d4-9262996c2af7` | yes |
| Stitch and Style | BR-0002 | `61de6ff4-849a-4971-9911-7ed17b4d871e` | yes |

**Recommended target branch:** Main Branch (HQ) — matches admin `user_branches` sample pattern.

## Salesman (reference)

Prior unblock pack: **7** active salesman accounts with auth company-wide; recommended DIN BRIDAL candidate Noman Ali (`no***@yahoo.com`). Password **not** in approved local source.

## RBAC / creation tooling

| Item | Value |
|------|-------|
| Role name | `manager` (enum on `public.users.role`) |
| Approved creation path | `create-erp-user` edge function via `userService.createUserWithAuth` (admin JWT) **or** service-role `auth.admin.createUser` + `public.users` insert pattern |
| `user_branches` | assign `branch_ids` + optional `default_branch_id` |
| Migrations required | **no** |
| GL / business mutation | **none** for user-only creation |

No secrets printed.
