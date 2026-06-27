# Phase 2.13 Party Ledger loader QA — soak-final

**Overall:** PASS

- [PASS] admin login
- [PASS] Party Ledger main loader (soak-final) — expected=unified actual=unified
- [PASS] Party Ledger MR JALIL closing readable — closing=216300
- [PASS] preview compare source — expected=legacy_shadow actual=legacy_shadow
- [PASS] Party Ledger closing matches legacy golden — golden=216300 actual=216300
- [PASS] Account Statement main loader still unified — actual=unified
- [PASS] Account Statement MR JALIL 216300 — closing=216300
- [PASS] Trial Balance main loader still unified — actual=unified
- [PASS] Trial Balance debit = credit golden — debit=407957271.02 credit=407957271.02
- [PASS] Ledger V2 main loader still unified — actual=unified
- [PASS] Ledger V2 MR JALIL 216300 — closing=216300
- [PASS] Admin Compare Pilot Batch 9/9 — compared=9 pass=9 fail=0