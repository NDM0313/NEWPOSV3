# DIN COUTURE golden capture

**Date:** 2026-06-27T13:12:05.217Z
**Party:** DHARIA
**Company id:** 2ab65903-62a3-4bcf-bced-076b681e9b74

- [PASS] login — credentials present
- [PASS] Party Ledger legacy loader — loader=legacy closing=4488088
- [PASS] Account Statement — closing=4488088
- [PASS] Ledger V2 — closing=4488088
- [PASS] Trial Balance debit=credit — debit=49747104 credit=49747104
- [PASS] DIN COUTURE TB fingerprint — debit=49747104 expected~49747104
- [PASS] Roznamcha legacy loader — loader=legacy
- [PASS] Roznamcha totals — in=85000 out=34500 close=50500
- [PASS] Party Ledger closing — closing=4488088
- [PASS] Account Statement closing — closing=4488088
- [PASS] Ledger V2 closing — closing=4488088

## Captured values
```json
{
  "capturedAt": "2026-06-27T13:12:05.217Z",
  "company": "DIN COUTURE",
  "company_id": "2ab65903-62a3-4bcf-bced-076b681e9b74",
  "party": "DHARIA",
  "party_id": "04831980-546b-4ff2-bc9d-2e75a43eb51c",
  "date_range": {
    "start": "2000-01-01",
    "end": "2026-06-27"
  },
  "branch_scope": "all",
  "party_ledger": {
    "loader": "legacy",
    "closing": 4488088
  },
  "account_statement": {
    "loader": "legacy",
    "closing": 4488088
  },
  "ledger_v2": {
    "loader": "legacy",
    "closing": 4488088
  },
  "trial_balance": {
    "loader": "legacy",
    "debit": 49747104,
    "credit": 49747104
  },
  "roznamcha": {
    "loader": "legacy",
    "cashIn": 85000,
    "cashOut": 34500,
    "closing": 50500
  }
}
```