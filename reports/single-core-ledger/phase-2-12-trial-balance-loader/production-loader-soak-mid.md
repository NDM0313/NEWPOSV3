# Phase 2.12 Trial Balance loader QA — soak-mid

**Overall:** PASS

- [PASS] admin login
- [PASS] Trial Balance main loader (soak-mid) — expected=unified actual=unified
- [PASS] Trial Balance debit = credit — debit=407957271.02 credit=407957271.02 diff=0
- [PASS] preview compare source — expected=legacy_shadow actual=legacy_shadow
- [PASS] unified totals match legacy golden — golden debit=407957271.02 credit=407957271.02
- [PASS] Ledger V2 main loader still unified — actual=unified
- [PASS] Ledger V2 MR JALIL 216300 — closing=216300
- [PASS] Account Statement main loader still unified — actual=unified
- [PASS] Account Statement MR JALIL 216300 — closing=216300
- [PASS] Admin Compare Pilot Batch 9/9 — compared=9 pass=9 fail=0