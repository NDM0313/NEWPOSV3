# ROLE_RLS_QA.md

Generated: 2026-07-17T12:52:01.214Z

## Client hub gates
Unit tests (`finalization.test.ts`, `reportsHubCatalog`, `permissions.test.ts`): **PASS**

## Live server / RLS

| Role | User | Company | Branch | Scenario | UI gate | RPC | Server | Visible | Status |
|---|---|---|---|---|---|---|---|---|---|
| admin | din@yahoo.com | DIN CHINA | null | admin_signin | n/a | auth.signIn | session | ok | **PASS** |
| admin | din@yahoo.com | DIN CHINA | null | own_company_tb | — | get_unified_trial_balance | data returned | ok | **PASS** |
| admin | din@yahoo.com | DIN BRIDAL (cross) | null | cross_company_bridal_tb | — | get_unified_trial_balance | ACCESS_DENIED: company scope mismatch | denied | **PASS** |
| admin | din@yahoo.com | DIN COUTURE (cross) | null | cross_company_couture_tb | — | get_unified_trial_balance | ACCESS_DENIED: company scope mismatch | denied | **PASS** |
| salesman | (none) | — | — | login | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | company_scope | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | branch_scope | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | unrestricted_tb_denied | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | unrestricted_account_ledger_denied | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | supplier_accounting_denied | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | purchase_accounting_denied | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | account_transfer_denied | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | direct_route_bypass | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | denial_not_zero | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | denial_not_empty_success | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | walkin_customer_scope | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| salesman | (none) | — | — | logout_clears | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** |
| limited/easy | (none) | — | — | login | — | — | Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED | — | **NOT_RUN_CREDENTIAL_GATED** |
| limited/easy | (none) | — | — | easy_subset | — | — | Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED | — | **NOT_RUN_CREDENTIAL_GATED** |
| limited/easy | (none) | — | — | full_accounting_restricted | — | — | Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED | — | **NOT_RUN_CREDENTIAL_GATED** |
| limited/easy | (none) | — | — | direct_url_bypass | — | — | Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED | — | **NOT_RUN_CREDENTIAL_GATED** |
| limited/easy | (none) | — | — | denial_visible_not_zero | — | — | Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED | — | **NOT_RUN_CREDENTIAL_GATED** |
| limited/easy | (none) | — | — | company_branch_scope | — | — | Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED | — | **NOT_RUN_CREDENTIAL_GATED** |
| branch-restricted | (none) | — | — | own_branch_ok | — | — | Set QA_BROWSER_EMAIL_BRANCH + QA_BROWSER_PASSWORD_BRANCH | — | **NOT_RUN_CREDENTIAL_GATED** |
| branch-restricted | (none) | — | — | other_branch_denied | — | — | Set QA_BROWSER_EMAIL_BRANCH + QA_BROWSER_PASSWORD_BRANCH | — | **NOT_RUN_CREDENTIAL_GATED** |
| branch-restricted | (none) | — | — | company_wide_null_denied | — | — | Set QA_BROWSER_EMAIL_BRANCH + QA_BROWSER_PASSWORD_BRANCH | — | **NOT_RUN_CREDENTIAL_GATED** |
| branch-restricted | (none) | — | — | branch_switch_no_stale | — | — | Set QA_BROWSER_EMAIL_BRANCH + QA_BROWSER_PASSWORD_BRANCH | — | **NOT_RUN_CREDENTIAL_GATED** |

### Summary
- Admin live: 4 PASS / 0 FAIL
- Salesman: NOT_RUN_CREDENTIAL_GATED
- Limited: NOT_RUN_CREDENTIAL_GATED
- Branch-restricted: NOT_RUN_CREDENTIAL_GATED

Active salesman accounts exist in production (e.g. `noman@yahoo.com` / DIN BRIDAL) but passwords are **not** in approved local env — operator must supply securely.
