# DIN BRIDAL production monitoring

**Profile:** din-bridal
**Date:** 2026-07-11T16:04:43.268Z
**URL:** https://erp.dincouture.pk
**Core gates:** FAIL
**Overall:** PASS WITH WAIVERS

- [PASS] DIN BRIDAL expected flags ON — keys=18/18
- [PASS] no other company loaders ON — count=0
- [PASS] admin login
- [FAIL] Roznamcha main loader unified — actual=legacy
- [FAIL] Roznamcha preview legacy_shadow — actual=unified_compare
- [FAIL] Roznamcha Cash In golden — actual=0
- [FAIL] Roznamcha Cash Out golden — actual=0
- [FAIL] Roznamcha Closing golden — actual=0
- [FAIL] Account Statement loader unified — actual=legacy
- [FAIL] Account Statement MR REHAN ALI — closing=0
- [PASS] Trial Balance loader unified — actual=unified
- [PASS] Trial Balance debit = credit — debit=26410077 credit=26410077
- [PASS] Trial Balance golden total — debit=26410077
- [PASS] Party Ledger loader unified — actual=unified
- [PASS] Party Ledger MR REHAN ALI — closing=530000
- [PASS] Ledger V2 loader unified — actual=unified
- [PASS] Ledger V2 MR REHAN ALI — closing=530000
- [WAIVED] Admin Compare Pilot Batch — skipped for din-bridal profile
- [WAIVED] no material console/RPC errors — [SUPABASE CONTEXT] Error ensuring default accounts: Error: Mandatory payment account 1000 missing after COA seed
    at Object.ensureDefaultAccounts (https://erp.dincouture.pk/assets/index-CSUXHLC6.js:241:13218) | [SUPABASE CONTEXT] Error ensuring default accounts: Error: Mandatory payment account 1000 missing after COA seed
    at Object.ensureDefaultAccounts (https://erp.dincouture.pk/assets/index-CSUXHLC6.js:241:13218)