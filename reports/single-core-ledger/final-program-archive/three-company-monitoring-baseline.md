# Three-company unified ledger — operational monitoring baseline

**Run:** THREE-COMPANY UNIFIED LEDGER FINAL ARCHIVE + OPERATIONAL BASELINE  
**Generated:** 2026-06-14T00:00:00Z  
**Production URL:** https://erp.dincouture.pk  
**Overall:** **PASS**

---

## DIN COUTURE (`MONITORING_PROFILE=din-couture`, `zhd@dincouture.pk`)

| Check | Expected (PKR) | Actual | Result |
|-------|----------------|--------|--------|
| Ledger V2 DHARIA closing | 4,488,088 | 4,488,088 | PASS |
| Account Statement DHARIA closing | 4,488,088 | 4,488,088 | PASS |
| Party Ledger DHARIA closing | 4,488,088 | 4,488,088 | PASS |
| Trial Balance debit = credit | 49,747,104 | 49,747,104 | PASS |
| Roznamcha In / Out / Closing | 85,000 / 34,500 / 50,500 | Match | PASS |
| Flags 12/12, other-company loaders | 0 | 0 | PASS |

**Phase 2.16 monitoring: PASS**

---

## DIN BRIDAL (`MONITORING_PROFILE=din-bridal`, `ndm313@yahoo.com`)

| Check | Expected (PKR) | Actual | Result |
|-------|----------------|--------|--------|
| Ledger V2 MR REHAN ALI closing | 530,000 | 530,000 | PASS |
| Account Statement MR REHAN ALI closing | 530,000 | 530,000 | PASS |
| Party Ledger MR REHAN ALI closing | 530,000 | 530,000 | PASS |
| Trial Balance debit = credit | 21,919,575 | 21,919,575 | PASS |
| Roznamcha In / Out / Closing | 1,836,350 / 917,780 / 918,570 | Match | PASS |
| Flags 12/12, other-company loaders | 0 | 0 | PASS |

**Phase 2.16 monitoring: PASS**

---

## DIN CHINA (`MONITORING_PROFILE=din-china`, `din@yahoo.com`)

| Check | Expected (PKR) | Actual | Result |
|-------|----------------|--------|--------|
| Ledger V2 MR JALIL closing | 216,300 | 216,300 | PASS |
| Account Statement MR JALIL closing | 216,300 | 216,300 | PASS |
| Party Ledger MR JALIL closing | 216,300 | 216,300 | PASS |
| Trial Balance debit = credit | 407,957,271.02 | 407,957,271.02 | PASS |
| Roznamcha In / Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 | Match | PASS |
| Admin Compare Pilot Batch | 9/9 | 9/9 | PASS |
| Flags 12/12, other-company loaders | 0 | 0 | PASS |

**Phase 2.16 monitoring: PASS**

---

## Tooling note

Monitoring guard in `run-phase-216-monitoring-verify.mjs` was aligned to treat DIN CHINA, DIN BRIDAL, and DIN COUTURE as approved loader companies (verification-only change). Pre-alignment runs reported a false FAIL on `no other company loaders ON` for din-china/din-bridal profiles while all golden checks passed; read-only DB guard confirmed only three approved companies have loaders.

---

## Verdict

**THREE-COMPANY MONITORING BASELINE: PASS**
