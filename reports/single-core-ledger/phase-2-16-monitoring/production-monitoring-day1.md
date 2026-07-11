# DIN CHINA production monitoring

**Profile:** din-china
**Date:** 2026-07-11T15:59:11.167Z
**URL:** https://erp.dincouture.pk
**Core gates:** FAIL
**Overall:** PASS WITH WAIVERS

- [PASS] DIN CHINA expected flags ON — keys=18/18
- [PASS] no other company loaders ON — count=0
- [PASS] admin login
- [PASS] Roznamcha main loader unified — actual=unified
- [PASS] Roznamcha preview legacy_shadow — actual=legacy_shadow
- [FAIL] Roznamcha Cash In golden — actual=60502230 (effective=WAIVED)
- [FAIL] Roznamcha Cash Out golden — actual=55919613 (effective=WAIVED)
- [FAIL] Roznamcha Closing golden — actual=4582617 (effective=WAIVED)
- [PASS] Account Statement loader unified — actual=unified
- [FAIL] Account Statement MR JALIL — closing=116299
- [PASS] Trial Balance loader unified — actual=unified
- [PASS] Trial Balance debit = credit — debit=374799344.15 credit=374799344.15
- [FAIL] Trial Balance golden total — debit=374799344.15 (effective=WAIVED)
- [PASS] Party Ledger loader unified — actual=unified
- [FAIL] Party Ledger MR JALIL — closing=116299
- [PASS] Ledger V2 loader unified — actual=unified
- [FAIL] Ledger V2 MR JALIL — closing=116299
- [PASS] Admin Compare Pilot Batch 9/9 — compared=9 pass=9 fail=0 maxAbsDiff=0
- [WAIVED] no material console/RPC errors — [SUPABASE CONTEXT] Error ensuring default accounts: Error: Mandatory payment account 1000 missing after COA seed
    at Object.ensureDefaultAccounts (https://erp.dincouture.pk/assets/index-CSUXHLC6.js:241:13218)