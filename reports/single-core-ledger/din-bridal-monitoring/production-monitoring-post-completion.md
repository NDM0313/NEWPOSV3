# DIN BRIDAL production monitoring — post-completion baseline

**Profile:** din-bridal  
**Run:** R5 DIN BRIDAL POST-COMPLETION ARCHIVE + OPERATIONAL MONITORING BASELINE  
**Date:** 2026-06-27T17:26:05Z  
**URL:** https://erp.dincouture.pk  
**Core gates:** PASS  
**Overall:** PASS

---

## Golden checks

| Screen | Golden (PKR) | Actual | Result |
|--------|--------------|--------|--------|
| Ledger V2 MR REHAN ALI closing | 530,000 | 530,000 | PASS |
| Account Statement MR REHAN ALI closing | 530,000 | 530,000 | PASS |
| Party Ledger MR REHAN ALI closing | 530,000 | 530,000 | PASS |
| Trial Balance debit = credit | 21,919,575 | 21,919,575 / 21,919,575 | PASS |
| Roznamcha Cash In | 1,836,350 | 1,836,350 | PASS |
| Roznamcha Cash Out | 917,780 | 917,780 | PASS |
| Roznamcha Closing | 918,570 | 918,570 | PASS |

---

## Full gate log

- [PASS] DIN BRIDAL expected flags ON — keys=12/12
- [PASS] no other company loaders ON — count=0
- [PASS] admin login
- [PASS] Roznamcha main loader unified — actual=unified
- [PASS] Roznamcha preview legacy_shadow — actual=legacy_shadow
- [PASS] Roznamcha Cash In golden — actual=1836350
- [PASS] Roznamcha Cash Out golden — actual=917780
- [PASS] Roznamcha Closing golden — actual=918570
- [PASS] Account Statement loader unified — actual=unified
- [PASS] Account Statement MR REHAN ALI — closing=530000
- [PASS] Trial Balance loader unified — actual=unified
- [PASS] Trial Balance debit = credit — debit=21919575 credit=21919575
- [PASS] Trial Balance golden total — debit=21919575
- [PASS] Party Ledger loader unified — actual=unified
- [PASS] Party Ledger MR REHAN ALI — closing=530000
- [PASS] Ledger V2 loader unified — actual=unified
- [PASS] Ledger V2 MR REHAN ALI — closing=530000
- [WAIVED] Admin Compare Pilot Batch — skipped for din-bridal profile
- [PASS] no material console/RPC errors — none

**Phase 2.16 monitoring: PASS**

---

## Regression

- **DIN CHINA:** 12/12 flags ON, 5/5 loaders ON — PASS (via monitoring profile flag audit)
- **Other-company loaders:** 0 — PASS

---

## Operational note

Schedule periodic re-runs:

```bash
MONITORING_PROFILE=din-bridal node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs
```
