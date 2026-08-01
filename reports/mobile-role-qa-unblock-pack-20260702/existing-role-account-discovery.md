# Existing role account discovery (read-only)

**Run local date/time:** 2026-07-02 19:32:18 +05:00  
**Method:** Read-only query via existing `migration-tools/.env.migration` service role pattern (same as other approved audit scripts). **No passwords printed.**

**Classification:** `READ_ONLY_DISCOVERY_OK`

## Summary

| Role type | Count | QA-usable (active + auth + email) |
|-----------|-------|-----------------------------------|
| Manager | **0** | **0** |
| Salesman / worker candidates | **8** | **7** |

## Manager candidates

**None found** with `role = manager` across DIN CHINA, DIN BRIDAL, DIN COUTURE.

## Salesman candidates (masked emails)

| Masked email | Name | Company | Active | Auth linked | QA usable |
|--------------|------|---------|--------|-------------|-----------|
| no***@yahoo.com | Noman Ali | DIN BRIDAL | yes | yes | yes |
| na***@yahoo.com | Nabeel | DIN BRIDAL | yes | yes | yes |
| mo***@yahoo.com | Mohsin Ali | DIN BRIDAL | yes | yes | yes |
| al***@yahoo.com | Ali | DIN BRIDAL | yes | yes | yes |
| sa***@yahoo.com | Saghir | DIN COUTURE | yes | yes | yes |
| ar***@yahoo.com | Arslan | DIN COUTURE | yes | yes | yes |
| us***@yahoo.com | Usman | DIN COUTURE | yes | yes | yes |
| ab***@yahoo.com | abdullah | DIN BRIDAL | **no** | yes | **no** (inactive) |

Branch assignments: none returned in `user_branches` for listed users (operator should confirm branch scope at QA).

Last login: all `null` in `users.last_login_at` for listed rows.

## Implications

- **Manager QA** requires **Option A** (promote/designate + credentials) or **Option B** (create temporary Manager QA user with explicit approval).
- **Salesman QA** can use **Option A** — pick one active DIN BRIDAL salesman; operator provides password out-of-band.

No users created. No production mutation.
