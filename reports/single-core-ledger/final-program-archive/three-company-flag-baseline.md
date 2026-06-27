# Three-company unified ledger — production flag baseline (read-only)

**Run:** THREE-COMPANY UNIFIED LEDGER FINAL ARCHIVE + OPERATIONAL BASELINE  
**Generated:** 2026-06-14T00:00:00Z  
**Method:** Read-only SQL via VPS (`dc-monitoring-flags-pipe.sql`, `three-company-loader-guard-pipe.sql`)  
**Overall:** **PASS**

---

## Per-company unified flags

| Company | Company ID | Flags ON | Loaders ON | Expected |
|---------|------------|----------|------------|----------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` | 12/12 | 5/5 | 12/12, 5/5 |
| DIN BRIDAL | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` | 12/12 | 5/5 | 12/12, 5/5 |
| DIN COUTURE | `2ab65903-62a3-4bcf-bced-076b681e9b74` | 12/12 | 5/5 | 12/12, 5/5 |

All twelve keys per company (`unified_ledger_pilot`, `unified_ledger_engine`, five screen + five loader pairs) report `enabled=true`.

---

## Cross-company loader guard

Companies with any `unified_ledger_loader_*` ON:

| Company | Loaders ON |
|---------|------------|
| DIN BRIDAL | 5 |
| DIN CHINA | 5 |
| DIN COUTURE | 5 |

| Check | Result |
|-------|--------|
| Other-company loaders (unapproved companies) | **0** |
| Cross-company leakage | **false** — only three approved companies have loaders |

---

## Verdict

**THREE-COMPANY FLAG BASELINE: PASS**
