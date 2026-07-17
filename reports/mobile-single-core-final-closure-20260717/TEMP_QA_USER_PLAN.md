# TEMP_QA_USER_PLAN.md

**Status:** PREPARED — **NOT EXECUTED**

**Required approval phrase (not supplied in this run):**
`APPROVE_CREATE_TEMP_MOBILE_QA_USERS`

## Why this plan exists

Read-only inventory found:

| Need | Inventory result |
|------|------------------|
| Active Limited / easy / viewer / staff QA user | **None** (`QA_IDENTITY_NOT_AVAILABLE`) |
| Active branch-restricted non-admin with `user_branches` | **None** (`QA_IDENTITY_NOT_AVAILABLE`) |
| Existing inactive QA-like emails | Only inactive salesman `ab***@yahoo.com` (DIN BRIDAL) — wrong role for Limited/branch suite |
| Staging/test users | **None** found |

Active roles in production: **admin (5)** · **salesman (7)** only.

## Approved creation workflow (do not use ad-hoc SQL)

Use existing edge function:

`supabase/functions/create-erp-user/index.ts`

Called with **admin/owner JWT** via Web ERP User Management / `userService.createUserWithAuth` pattern.

Inputs supported: `email`, `full_name`, `role`, `company_id`, `temporary_password` or invite, `branch_ids`, `account_ids`, `is_active`, `is_salesman`.

## Proposed temporary identities (masked)

| Purpose | Proposed masked email | Role | Company | Branch | Notes |
|---------|----------------------|------|---------|--------|-------|
| Limited / easy | `mobile.qa.limited+YYYYMMDD@…` (operator-controlled inbox) | `viewer` or `staff` (least privilege; **not** admin/salesman) | DIN BRIDAL `597a5292-…` | Main Branch `cc920703-…` only | Easy reports only; deny full accounting |
| Branch-restricted | `mobile.qa.branch+YYYYMMDD@…` | `staff` or `viewer` | DIN BRIDAL | **Only** Main Branch `cc920703-…` | Deny other branch `61de6ff4-…`; deny `branch=null` company-wide |

Passwords: operator-generated, keyboard entry / env only — **never** committed.

## Permission matrix (intent)

| Capability | Limited QA | Branch QA |
|------------|------------|-----------|
| Login | allow | allow |
| Easy / customer-facing reports | allow (subset) | allow (own branch) |
| Trial Balance / full Account Ledger / Cash Flow advanced | **deny** | **deny** unless policy requires |
| Supplier / purchase accounting | **deny** | **deny** |
| Account transfer | **deny** | **deny** |
| Cross-company | **deny** | **deny** |
| Other branch | n/a | **deny** |
| Company-wide `branch=null` | deny unless policy | **deny** |
| Create sale/purchase/payment/JE | **deny** | **deny** |

## Expiry / removal plan

1. Tag users in `full_name` as `TEMP Mobile QA — remove after Single Core closure`.
2. After evidence pack complete: set `is_active=false` via approved admin UI / `create-erp-user` update path or user-admin actions.
3. Optionally delete Auth user only through approved admin workflow.
4. Remove `user_branches` / account access assignments.
5. Record deactivation timestamp in evidence.

## Rollback

- Prefer **deactivate** over hard delete.
- No migrations.
- No financial tables touched.
- Confirm no sales/payments/JEs created under these users (read-only QA only).

## Execution gate

Do **not** create these users until the operator supplies exactly:

`APPROVE_CREATE_TEMP_MOBILE_QA_USERS`

and provides operator-controlled emails + passwords via secure env vars.
