# DIN BRIDAL production monitoring

**Profile:** din-bridal
**Date:** 2026-07-11T12:20:21.154Z
**URL:** https://erp.dincouture.pk
**Core gates:** PASS
**Overall:** PASS

- [PASS] DIN BRIDAL expected flags ON — keys=18/18
- [PASS] no other company loaders ON — count=0
- [PASS] admin login
- [PASS] Roznamcha main loader unified — actual=unified
- [PASS] Roznamcha preview legacy_shadow — actual=legacy_shadow
- [PASS] Roznamcha Cash In golden — actual=2850850
- [PASS] Roznamcha Cash Out golden — actual=1794607
- [PASS] Roznamcha Closing golden — actual=1056243
- [PASS] Account Statement loader unified — actual=unified
- [PASS] Account Statement MR REHAN ALI — closing=530000
- [PASS] Trial Balance loader unified — actual=unified
- [PASS] Trial Balance debit = credit — debit=26410077 credit=26410077
- [PASS] Trial Balance golden total — debit=26410077
- [PASS] Party Ledger loader unified — actual=unified
- [PASS] Party Ledger MR REHAN ALI — closing=530000
- [PASS] Ledger V2 loader unified — actual=unified
- [PASS] Ledger V2 MR REHAN ALI — closing=530000
- [WAIVED] Admin Compare Pilot Batch — skipped for din-bridal profile
- [WAIVED] no material console/RPC errors — [SUPABASE CONTEXT] Error ensuring default accounts: Error: Mandatory payment account 1000 missing after COA seed
    at Object.ensureDefaultAccounts (https://erp.dincouture.pk/assets/index-DLGA0NYj.js:241:13218) | [SUPABASE CONTEXT] Error ensuring default accounts: Error: Mandatory payment account 1000 missing after COA seed
    at Object.ensureDefaultAccounts (https://erp.dincouture.pk/assets/index-DLGA0NYj.js:241:13218)