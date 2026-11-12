# DIN CHINA production monitoring

**Profile:** din-china
**Date:** 2026-07-17T10:49:41.657Z
**URL:** https://erp.dincouture.pk
**Core gates:** FAIL
**Overall:** PASS WITH WAIVERS

- [PASS] DIN CHINA expected flags ON — keys=18/18
- [PASS] no other company loaders ON — count=0
- [PASS] admin login
- [PASS] Roznamcha main loader unified — actual=unified
- [PASS] Roznamcha preview legacy_shadow — actual=legacy_shadow
- [FAIL] Roznamcha Cash In golden — actual=63340595 (effective=WAIVED)
- [FAIL] Roznamcha Cash Out golden — actual=71926337 (effective=WAIVED)
- [FAIL] Roznamcha Closing golden — actual=-8585742 (effective=WAIVED)
- [PASS] Account Statement loader unified — actual=unified
- [FAIL] Account Statement MR JALIL — closing=66299
- [PASS] Trial Balance loader unified — actual=unified
- [PASS] Trial Balance debit = credit — debit=394526433.15 credit=394526433.15
- [FAIL] Trial Balance golden total — debit=394526433.15 (effective=WAIVED)
- [PASS] Party Ledger loader unified — actual=unified
- [FAIL] Party Ledger MR JALIL — closing=66299
- [PASS] Ledger V2 loader unified — actual=unified
- [FAIL] Ledger V2 MR JALIL — closing=66299
- [PASS] Admin Compare Pilot Batch 9/9 — compared=9 pass=9 fail=0 maxAbsDiff=0
- [PASS] no material console/RPC errors — none