# Single Core Ledger — Systemwide Diagnostic Report

> Generated from staging/clone run. **Do not treat as production sign-off without applied migrations.**

## Run metadata

| Field | Value |
|-------|-------|
| Run timestamp (UTC) | 2026-06-23T15:50:06.427Z |
| companies_count | 3 |
| JSON output path | `/root/NEWPOSV3-phase-15-validate/reports/single-core-ledger/diagnostics-2026-06-23T15-50-06-427Z.json` |
| JSON SHA256 | `f93e10d9797390cc2c3ccee0dc7b95bb3342add44cb9a6b60eb530695918e70e` |
| Overall status | **PASS** |

## Pass / fail summary

- strict_pass_count: 3
- strict_fail_count: 0
- branch_attribution_risk_total: 0
- warnings_unposted_sales: 0
- warnings_unposted_purchases: 0

## DIN CHINA pilot section

### DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

**Per-company metrics + fix_class:**

```json
{
  "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
  "company_name": "DIN CHINA",
  "company_is_active": true,
  "payments_missing_contact_sale_linked": 0,
  "payments_wrong_party_attribution": 0,
  "branch_attribution_risk": 0,
  "unposted_final_sales": 0,
  "unposted_final_purchases": 0,
  "unposted_rentals": 0,
  "correction_reversal_je_count": 0,
  "opening_balance_null_branch_je_count": 11,
  "strict_pass": true,
  "issues": [
    {
      "field": "opening_balance_null_branch_je_count",
      "count": 11,
      "fix_class": "opening_balance_branch_review",
      "severity": "info"
    }
  ]
}
```

## Per-company diagnostics (all companies)

- **DIN BRIDAL**: strict_pass=true, issues=[{"field":"opening_balance_null_branch_je_count","count":173,"fix_class":"opening_balance_branch_review","severity":"info"}]
- **DIN CHINA**: strict_pass=true, issues=[{"field":"opening_balance_null_branch_je_count","count":11,"fix_class":"opening_balance_branch_review","severity":"info"}]
- **DIN COUTURE**: strict_pass=true, issues=[{"field":"opening_balance_null_branch_je_count","count":72,"fix_class":"opening_balance_branch_review","severity":"info"}]
## Unresolved differences (strict fail companies)

_None — all companies passed strict gate._
