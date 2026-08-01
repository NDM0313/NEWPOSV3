# Post-apply monitoring — DIN BRIDAL 1100 Option C apply

**Artifact:** `2026-06-30T15-07-43-057Z`  
**Overall:** FAIL (expected golden fixture drift)

| Check | Result |
|-------|--------|
| din-china | PASS |
| din-bridal | FAIL — Trial Balance golden total only |
| din-couture | PASS |
| Admin Compare 9/9 | PASS on din-china; waived on din-bridal profile |
| other-company loaders | 0 |
| migrations_run | false |

## din-bridal failure analysis (expected)

| Check | Result | Notes |
|-------|--------|-------|
| Trial Balance debit = credit | PASS | 22,056,075 = 22,056,075 |
| Trial Balance golden total | **FAIL** | actual debit=22,056,075; golden=21,919,575 |
| All other checks | PASS | Roznamcha, Party Ledger MR REHAN ALI, Ledger V2 unchanged |

**Delta:** PKR **136,500** — exactly matches the approved additive correction (two balanced JEs each add Dr+Cr to TB column totals). This is **expected** after Option C apply; `golden-fixtures.json` `trial_balance_debit_pkr` requires finance refresh (not in scope of this apply run).

## Approved GL mutation

Two additive `gl_correction` JEs: JV-000209, JV-000210 (DIN BRIDAL only).

Source: `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-30T15-07-43-057Z.json`
