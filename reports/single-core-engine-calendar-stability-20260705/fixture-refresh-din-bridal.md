# DIN BRIDAL fixture-only golden refresh — Calendar Day 5 (2026-07-05)

**Operator approval:** Option A approved — Nadeem Khan 2026-07-05  
**Classification:** legitimate live activity drift (not production regression)

## Prior vs new golden (PKR)

| Metric | Prior (2026-07-02) | New (2026-07-05) |
|--------|---------------------|------------------|
| Trial Balance total | 22,390,400 | **23,279,377** |
| Roznamcha Cash In | 2,026,850 | **2,211,350** |
| Roznamcha Cash Out | 917,780 | **1,164,607** |
| Roznamcha Closing | 1,109,070 | **1,046,743** |
| Party MR REHAN ALI closing | 530,000 | **530,000** (unchanged) |

## Safety

| Item | Value |
|------|--------|
| Production GL mutation | **none** |
| Migrations | **none** |
| Repairs | **none** |
| Fixture files updated | `monitoring-company-profiles.json`, `din-bridal/golden-fixtures.json` |
| Source fail artifact | `three-company-monitoring-2026-07-05T08-50-05-012Z.json` |
| Post-refresh pass artifact | `three-company-monitoring-2026-07-05T09-05-15-899Z.json` |

## Post-refresh monitoring

**PASS** — all three companies; loader guard PASS; TB debit=credit PASS for DIN BRIDAL.
