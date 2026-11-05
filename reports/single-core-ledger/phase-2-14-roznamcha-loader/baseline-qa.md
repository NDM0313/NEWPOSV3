# Phase 2.14 Roznamcha loader QA — baseline

**Overall:** FAIL

- [PASS] admin login
- [PASS] Roznamcha main loader (baseline) — expected=legacy actual=legacy
- [PASS] Roznamcha summary readable — opening=0 in=136158012 out=67042426 closing=69115586
- [PASS] preview compare source — expected=unified_compare actual=unified_compare
- [PASS] legacy golden captured
- [PASS] Account Statement main loader still unified — actual=unified
- [PASS] Account Statement MR JALIL 216300 — closing=216300
- [PASS] Party Ledger main loader still unified — actual=unified
- [PASS] Party Ledger MR JALIL 216300 — closing=216300
- [PASS] Trial Balance main loader still unified — actual=unified
- [PASS] Trial Balance debit = credit golden — debit=407957271.02 credit=407957271.02
- [PASS] Ledger V2 main loader still unified — actual=unified
- [FAIL] Ledger V2 MR JALIL 216300 — closing=NaN
- [FAIL] Admin Compare Pilot Batch 9/9 — compared=9 pass=3 fail=0