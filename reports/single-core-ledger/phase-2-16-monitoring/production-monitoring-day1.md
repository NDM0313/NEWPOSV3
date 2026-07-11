# DIN CHINA production monitoring

**Profile:** din-china
**Date:** 2026-07-11T12:18:03.802Z
**URL:** https://erp.dincouture.pk
**Core gates:** PASS
**Overall:** PASS

- [PASS] DIN CHINA expected flags ON — keys=18/18
- [PASS] no other company loaders ON — count=0
- [PASS] admin login
- [PASS] Roznamcha main loader unified — actual=unified
- [PASS] Roznamcha preview legacy_shadow — actual=legacy_shadow
- [PASS] Roznamcha Cash In golden — actual=60042230
- [FAIL] Roznamcha Cash Out golden — actual=54819613 (effective=WAIVED)
- [FAIL] Roznamcha Closing golden — actual=5222617 (effective=WAIVED)
- [PASS] Account Statement loader unified — actual=unified
- [PASS] Account Statement MR JALIL — closing=216299
- [PASS] Trial Balance loader unified — actual=unified
- [PASS] Trial Balance debit = credit — debit=373239344.15 credit=373239344.15
- [FAIL] Trial Balance golden total — debit=373239344.15 (effective=WAIVED)
- [PASS] Party Ledger loader unified — actual=unified
- [PASS] Party Ledger MR JALIL — closing=216299
- [PASS] Ledger V2 loader unified — actual=unified
- [PASS] Ledger V2 MR JALIL — closing=216299
- [PASS] Admin Compare Pilot Batch 9/9 — compared=9 pass=9 fail=0 maxAbsDiff=0
- [WAIVED] no material console/RPC errors — [SUPABASE CONTEXT] Error ensuring default accounts: Error: Mandatory payment account 1000 missing after COA seed
    at Object.ensureDefaultAccounts (https://erp.dincouture.pk/assets/index-DLGA0NYj.js:241:13218)