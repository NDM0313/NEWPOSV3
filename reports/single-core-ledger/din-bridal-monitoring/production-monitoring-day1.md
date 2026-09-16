# DIN BRIDAL production monitoring

**Profile:** din-bridal
**Date:** 2026-07-17T10:51:48.824Z
**URL:** https://erp.dincouture.pk
**Core gates:** PASS
**Overall:** PASS

- [PASS] DIN BRIDAL expected flags ON — keys=18/18
- [PASS] no other company loaders ON — count=0
- [PASS] admin login
- [PASS] Roznamcha main loader unified — actual=unified
- [PASS] Roznamcha preview legacy_shadow — actual=legacy_shadow
- [FAIL] Roznamcha Cash In golden — actual=2870850 (effective=WAIVED)
- [FAIL] Roznamcha Cash Out golden — actual=2234607 (effective=WAIVED)
- [FAIL] Roznamcha Closing golden — actual=636243 (effective=WAIVED)
- [PASS] Account Statement loader unified — actual=unified
- [PASS] Account Statement MR REHAN ALI — closing=530000
- [PASS] Trial Balance loader unified — actual=unified
- [PASS] Trial Balance debit = credit — debit=26952083 credit=26952083
- [FAIL] Trial Balance golden total — debit=26952083 (effective=WAIVED)
- [PASS] Party Ledger loader unified — actual=unified
- [PASS] Party Ledger MR REHAN ALI — closing=530000
- [PASS] Ledger V2 loader unified — actual=unified
- [PASS] Ledger V2 MR REHAN ALI — closing=530000
- [WAIVED] Admin Compare Pilot Batch — skipped for din-bridal profile
- [PASS] no material console/RPC errors — none