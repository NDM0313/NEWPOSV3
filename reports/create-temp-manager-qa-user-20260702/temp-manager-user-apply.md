# Temp Manager QA user apply

**Status:** `NOT_APPLIED` — blocked before creation

## Gate check

| Requirement | Met |
|-------------|-----|
| Operator Option B approval | **yes** (Nadeem Khan, scoped) |
| Exact operator-approved email | **no** |
| Secure password out-of-band | **no** |
| DIN BRIDAL company id | **yes** |
| Target branch id | **yes** |
| Manager role identified | **yes** (`manager`) |
| No migration required | **yes** |

## Action taken

**None.** User creation **not executed** per task gate: email and password missing.

## Ready apply steps (when unblocked)

1. Operator provides exact email + password securely (manual session or local uncommitted env var — never commit).
2. Invoke `create-erp-user` with admin session **or** approved service-role script pattern:
   - `role: manager`
   - `company_id: 597a5292-14c8-4cd8-96bd-c61b5a0d8c92`
   - `branch_ids: [cc920703-97a0-43a4-95d4-9262996c2af7]`
   - `default_branch_id: cc920703-97a0-43a4-95d4-9262996c2af7`
   - `full_name: Mobile QA Manager`
   - `is_active: true`
3. Read-only verify auth + public.users + user_branches.
4. Record masked email only in evidence.

No passwords logged. No GL mutation.
