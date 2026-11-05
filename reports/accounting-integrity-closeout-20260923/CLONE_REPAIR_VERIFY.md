# Clone repair verify

| Item | Result |
|------|--------|
| Clone DB | `newposv3_integrity_clone_20260923` |
| Restore source | `NEWPOSV3_FULL_20260923-005428.dump` |
| Restore notes | 9 non-blocking FK/extension warnings; JE/JEL counts matched prod |
| Repair | `repair_allowlisted_jes.sql` + COMMIT |

| Metric | After |
|--------|-------|
| DIN COLLECTION diff | **0** |
| DIN CHINA non-void / all | **0 / 0** |
| DIN BRIDAL non-void / all | **0 / 0** |
| DIN COUTURE | **0** |
| Global | **0** |
| Unbalanced JE count | **0** |
| PUR-0004 | cancelled / 190 |
| SL-0064 / SL-0067 | final totals unchanged |

**Verdict:** `CLONE_REPAIR_PASS`
