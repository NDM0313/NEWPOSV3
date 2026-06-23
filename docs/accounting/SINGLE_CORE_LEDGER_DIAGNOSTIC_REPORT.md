# Single Core Ledger — Systemwide Diagnostic Report

> Generated from staging/clone run. **Do not treat as production sign-off without applied migrations.**

## Run metadata

| Field | Value |
|-------|-------|
| Run timestamp (UTC) | 2026-06-23T14:20:34.284Z |
| companies_count | 3 |
| JSON output path | `/root/NEWPOSV3-phase-15-validate/reports/single-core-ledger/diagnostics-2026-06-23T14-20-34-284Z.json` |
| JSON SHA256 | `b07fd3deb18924111b9b284ddd84cc7639dc56daa99bc6c659edc82a4fc848cd` |
| Overall status | **FAIL** |

## Pass / fail summary

- strict_pass_count: 1
- strict_fail_count: 2
- branch_attribution_risk_total: 8
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
  "payments_missing_contact_sale_linked": 70,
  "payments_wrong_party_attribution": 0,
  "branch_attribution_risk": 4,
  "unposted_final_sales": 0,
  "unposted_final_purchases": 0,
  "unposted_rentals": 0,
  "correction_reversal_je_count": 0,
  "opening_balance_null_branch_je_count": 11,
  "strict_pass": false,
  "issues": [
    {
      "field": "payments_missing_contact_sale_linked",
      "count": 70,
      "fix_class": "payment_contact_backfill",
      "severity": "strict"
    },
    {
      "field": "branch_attribution_risk",
      "count": 4,
      "fix_class": "branch_attribution_review",
      "severity": "strict"
    },
    {
      "field": "opening_balance_null_branch_je_count",
      "count": 11,
      "fix_class": "opening_balance_branch_review",
      "severity": "info"
    }
  ]
}
```

**branch_attribution_risk sample rows:**

```json
[
  {
    "journal_entry_id": "1dd932ff-8798-46b4-8e47-b55832611515",
    "entry_no": "JE-0309",
    "entry_date": "2026-04-29T00:00:00.000Z",
    "reference_type": "manual_receipt",
    "branch_id": null,
    "description": "Customer receipt from MR YOUNS CHARSADA. [Edited 23/06/2026, 6:39 pm: Rs 58,500 → Rs 58,000]",
    "fix_class": "branch_attribution_review"
  },
  {
    "journal_entry_id": "653e66d2-6c38-41fc-b396-306488ae52e7",
    "entry_no": "JE-0287",
    "entry_date": "2026-04-24T00:00:00.000Z",
    "reference_type": "manual_receipt",
    "branch_id": null,
    "description": "Customer receipt from DIN COUTURE.",
    "fix_class": "branch_attribution_review"
  },
  {
    "journal_entry_id": "a1e0faf5-30ca-499b-9ba2-cc1bd8e25a67",
    "entry_no": "FT-000287",
    "entry_date": "2025-09-30T00:00:00.000Z",
    "reference_type": "transfer",
    "branch_id": null,
    "description": "Owner Capital → MCB last Year Finical",
    "fix_class": "branch_attribution_review"
  },
  {
    "journal_entry_id": "a1cc92d7-443f-465d-9473-9d6b526fdb99",
    "entry_no": "FT-000309",
    "entry_date": "2025-02-11T00:00:00.000Z",
    "reference_type": "transfer",
    "branch_id": null,
    "description": "Transfer MCB → WALI DIN T/T — WALI TT",
    "fix_class": "branch_attribution_review"
  }
]
```

## Per-company diagnostics (all companies)

- **DIN BRIDAL**: strict_pass=false, issues=[{"field":"payments_missing_contact_sale_linked","count":4,"fix_class":"payment_contact_backfill","severity":"strict"},{"field":"branch_attribution_risk","count":4,"fix_class":"branch_attribution_review","severity":"strict"},{"field":"opening_balance_null_branch_je_count","count":173,"fix_class":"opening_balance_branch_review","severity":"info"}]
- **DIN CHINA**: strict_pass=false, issues=[{"field":"payments_missing_contact_sale_linked","count":70,"fix_class":"payment_contact_backfill","severity":"strict"},{"field":"branch_attribution_risk","count":4,"fix_class":"branch_attribution_review","severity":"strict"},{"field":"opening_balance_null_branch_je_count","count":11,"fix_class":"opening_balance_branch_review","severity":"info"}]
- **DIN COUTURE**: strict_pass=true, issues=[{"field":"opening_balance_null_branch_je_count","count":72,"fix_class":"opening_balance_branch_review","severity":"info"}]
## Unresolved differences (strict fail companies)

- **DIN BRIDAL** (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`): branch_risk=4, missing_contact=4, wrong_party=0
- **DIN CHINA** (`30bd8592-3384-4f34-899a-f3907e336485`): branch_risk=4, missing_contact=70, wrong_party=0
