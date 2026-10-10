# DIN COUTURE production monitoring — FINAL

**Profile:** din-couture  
**Date:** 2026-06-27T13:19:25Z  
**URL:** https://erp.dincouture.pk  
**Core gates:** PASS  
**Overall:** PASS

## Golden checks

| Screen | Golden (PKR) | Actual |
|--------|--------------|--------|
| Ledger V2 DHARIA | 4,488,088 | 4,488,088 |
| Account Statement DHARIA | 4,488,088 | 4,488,088 |
| Party Ledger DHARIA | 4,488,088 | 4,488,088 |
| Trial Balance debit = credit | 49,747,104 | 49,747,104 |
| Roznamcha In / Out / Closing | 85,000 / 34,500 / 50,500 | Match |

## Regression

- DIN CHINA: 12/12 flags, 5/5 loaders — unchanged
- DIN BRIDAL: 12/12 flags, 5/5 loaders — unchanged
- Other-company loaders: 0

- [PASS] DIN COUTURE expected flags ON — keys=12/12
- [PASS] no other company loaders ON — count=0
- [PASS] no material console/RPC errors

**Phase 2.16 monitoring: PASS**
