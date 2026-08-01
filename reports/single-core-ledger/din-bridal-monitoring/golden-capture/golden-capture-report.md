# DIN BRIDAL golden capture

**Date:** 2026-06-27T11:34:40.043Z
**Party:** MR REHAN ALI
**Company id:** 597a5292-14c8-4cd8-96bd-c61b5a0d8c92

- [PASS] login — credentials present
- [INFO] Party Ledger legacy loader — loader=unified closing=530000
- [PASS] Account Statement — closing=530000
- [PASS] Ledger V2 — closing=530000
- [PASS] Trial Balance debit=credit — debit=21919575 credit=21919575
- [PASS] DIN BRIDAL TB fingerprint — debit=21919575 expected~21919575
- [INFO] Roznamcha legacy loader — loader=unified
- [PASS] Roznamcha totals — in=1836350 out=917780 close=918570
- [PASS] Party Ledger closing — closing=530000
- [PASS] Account Statement closing — closing=530000
- [PASS] Ledger V2 closing — closing=530000

## Captured values
```json
{
  "capturedAt": "2026-06-27T11:34:40.043Z",
  "company": "DIN BRIDAL",
  "company_id": "597a5292-14c8-4cd8-96bd-c61b5a0d8c92",
  "party": "MR REHAN ALI",
  "party_id": "cee98d04-0a04-4692-857c-18df75bcb466",
  "date_range": {
    "start": "2000-01-01",
    "end": "2026-06-27"
  },
  "branch_scope": "all",
  "party_ledger": {
    "loader": "unified",
    "closing": 530000
  },
  "account_statement": {
    "loader": "unified",
    "closing": 530000
  },
  "ledger_v2": {
    "loader": "unified",
    "closing": 530000
  },
  "trial_balance": {
    "loader": "unified",
    "debit": 21919575,
    "credit": 21919575
  },
  "roznamcha": {
    "loader": "unified",
    "cashIn": 1836350,
    "cashOut": 917780,
    "closing": 918570
  }
}
```