# Phase 2.12 — risk register

| Risk | Mitigation |
|------|------------|
| Debit ≠ credit on unified main | Golden gate + immediate L1 rollback |
| Totals differ from legacy golden | Capture baseline before loader ON; compare on candidate |
| Ledger V2 / Account Statement regression | QA script verifies MR JALIL 216300 + unified loaders |
| Wrong company flags | SQL targets DIN CHINA only; postverify script |
| Export mismatch | Exports use active main rows; spot-check in QA |
| Pilot Batch regression | Admin Compare 9/9 gate in QA |

**No migrations. No GL data mutation.**
