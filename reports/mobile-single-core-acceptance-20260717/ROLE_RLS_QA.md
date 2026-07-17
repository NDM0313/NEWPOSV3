# ROLE_RLS_QA.md

Generated: 2026-07-17T12:15:37.585Z

## Client hub gates (unit tests)
Automated `finalization.test.ts` + `reportsHubCatalog`: **PASS**

## Live server / RLS

| Scenario | UI gate | Client scope | RPC | Visible | Status | Note |
|---|---|---|---|---|---|---|
| admin_china_signin | — | — | — | — | **PASS** | session ok |
| admin_china_own_company_tb | n/a | china/null | get_unified_trial_balance | ok | **PASS** | data returned |
| admin_china_cross_company_bridal_tb | n/a | bridal/null (unauthorized company) | get_unified_trial_balance | denied | **PASS** | ACCESS_DENIED: company scope mismatch |
| admin_china_cross_company_couture_tb | n/a | couture/null | get_unified_trial_balance | denied | **PASS** | ACCESS_DENIED: company scope mismatch |
| salesman_unrestricted_tb | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** | No QA_BROWSER_EMAIL_SALESMAN / QA_BROWSER_PASSWORD_SALESMAN in env |
| salesman_account_ledger | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** | salesman credentials not in approved local env |
| salesman_supplier_purchase | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** | salesman credentials not in approved local env |
| salesman_account_transfer | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** | salesman credentials not in approved local env |
| limited_direct_route_bypass | — | — | — | — | **NOT_RUN_CREDENTIAL_GATED** | limited-user credentials not in env |
