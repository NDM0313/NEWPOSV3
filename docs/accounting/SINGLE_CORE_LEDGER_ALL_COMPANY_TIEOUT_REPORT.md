# Single Core Ledger — All-Company Tie-Out Report

## Run metadata

| Field | Value |
|-------|-------|
| Run timestamp (UTC) | 2026-06-23T15:36:21.773Z |
| companies_count | 1 |
| pilot_only | false |
| JSON output path | `/root/NEWPOSV3-phase-15-validate/reports/single-core-ledger/tieout-2026-06-23T15-36-21-773Z.json` |
| JSON SHA256 | `9b9f9050ce5c8d87289e0fb65e95583fb082e48e1c5299de535bdb6abb560777` |
| Overall status | **PASS** |

## Pass / fail summary

- comparisons_total: 9
- pass_count: 9
- fail_count: 0
- max_abs_difference: 0

## DIN CHINA pilot — trial balance & cash/bank

```json
{
  "All branches": {
    "trial_balance": {
      "total_debit": 407957271.02,
      "total_credit": 407957271.02,
      "difference": 0,
      "account_count": 49,
      "balanced": true
    },
    "cash_bank": {
      "row_count": 408,
      "liquidity_account_count": 14,
      "period_opening_balance": 0
    }
  },
  "Main Branch / HQ": {
    "trial_balance": {
      "total_debit": 375476071.02,
      "total_credit": 375476071.02,
      "difference": 0,
      "account_count": 49,
      "balanced": true
    },
    "cash_bank": {
      "row_count": 400,
      "liquidity_account_count": 14,
      "period_opening_balance": 0
    }
  },
  "BL0002": {
    "trial_balance": {
      "total_debit": 375476071.02,
      "total_credit": 375476071.02,
      "difference": 0,
      "account_count": 49,
      "balanced": true
    },
    "cash_bank": {
      "row_count": 400,
      "liquidity_account_count": 14,
      "period_opening_balance": 0
    }
  }
}
```

## DIN CHINA pilot — party comparisons

```json
[
  {
    "label": "DIN CHINA",
    "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
    "branch_scopes": [
      "All branches",
      "Main Branch / HQ",
      "BL0002"
    ],
    "comparisons": [
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": null,
        "branch_label": "All branches",
        "branch_code": null,
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "official_gl",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": null,
        "branch_label": "All branches",
        "branch_code": null,
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "effective_party",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": null,
        "branch_label": "All branches",
        "branch_code": null,
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "audit_full_history",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": "92f4184e-ee9b-4b6c-8e76-10ee1d166f55",
        "branch_label": "Main Branch / HQ",
        "branch_code": "BL0002",
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "official_gl",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": "92f4184e-ee9b-4b6c-8e76-10ee1d166f55",
        "branch_label": "Main Branch / HQ",
        "branch_code": "BL0002",
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "effective_party",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": "92f4184e-ee9b-4b6c-8e76-10ee1d166f55",
        "branch_label": "Main Branch / HQ",
        "branch_code": "BL0002",
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "audit_full_history",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": "92f4184e-ee9b-4b6c-8e76-10ee1d166f55",
        "branch_label": "BL0002",
        "branch_code": "BL0002",
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "official_gl",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": "92f4184e-ee9b-4b6c-8e76-10ee1d166f55",
        "branch_label": "BL0002",
        "branch_code": "BL0002",
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "effective_party",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      },
      {
        "company_id": "30bd8592-3384-4f34-899a-f3907e336485",
        "company_name": "DIN CHINA",
        "branch_id": "92f4184e-ee9b-4b6c-8e76-10ee1d166f55",
        "branch_label": "BL0002",
        "branch_code": "BL0002",
        "contact_id": "fe7ec33d-fd6d-4aa6-8d21-416e383b4c93",
        "contact_name": "MR JALIL",
        "contact_code": null,
        "party_type": "customer",
        "pattern_label": "JALIL",
        "basis": "audit_full_history",
        "old_source": "legacy_gl_rpc",
        "new_engine": "get_unified_party_ledger",
        "old_balance": 216300,
        "new_balance": 216300,
        "difference": 0,
        "old_row_count": 15,
        "new_row_count": 15,
        "legacy_error": null,
        "unified_error": null,
        "pass": true,
        "hybrid_note": "hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI",
        "operational_open_items_note": "operational_open_items: Phase 2 RPC pending"
      }
    ]
  }
]
```

## Every comparison row

| company | branch | contact | basis | old_source | old | new | diff | pass |
|---------|--------|---------|-------|------------|-----|-----|------|------|
| DIN CHINA | All branches | MR JALIL (—) | official_gl | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | All branches | MR JALIL (—) | effective_party | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | All branches | MR JALIL (—) | audit_full_history | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | Main Branch / HQ | MR JALIL (—) | official_gl | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | Main Branch / HQ | MR JALIL (—) | effective_party | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | Main Branch / HQ | MR JALIL (—) | audit_full_history | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | BL0002 | MR JALIL (—) | official_gl | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | BL0002 | MR JALIL (—) | effective_party | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |
| DIN CHINA | BL0002 | MR JALIL (—) | audit_full_history | legacy_gl_rpc | 216300 | 216300 | 0 | PASS |

## Unresolved differences

_None._

## Notes

- `legacy_gl_rpc`: existing AR/AP/worker GL journal RPCs.
- `hybrid_frontend_equivalent`: Account Statements hybrid path — compare in dev UI `/admin/unified-ledger-tieout` (not replicated in CLI).
- `operational_open_items`: Phase 2 RPC not yet available.
