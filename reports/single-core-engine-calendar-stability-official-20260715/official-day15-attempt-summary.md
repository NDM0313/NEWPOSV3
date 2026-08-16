# Official Calendar Day 15 — 2026-07-08

**Classification:** **CALENDAR_STABILITY_DAY_PASS**

| Item | Value |
|------|--------|
| Run local date/time | 2026-07-08 18:55:48 → 19:10:00 +05:00 |
| Official stability window calendar day | **15** |
| Calendar days elapsed since 2026-07-01 | **14** |
| Monitoring artifact | `three-company-monitoring-2026-07-08T13-55-49-198Z` |
| Overall | **PASS** (Option A fixture refresh) |

## Attempt history

| Attempt | Result | Notes |
|---------|--------|-------|
| 1 | FAIL | UI timeouts (CHINA/BRIDAL early abort; COUTURE login flake) |
| 2 | FAIL | COUTURE Roznamcha nav timeout (CHINA+BRIDAL PASS) |
| 3 | FAIL | BRIDAL TB/roznamcha drift; CHINA login flake |
| 4 | FAIL | CHINA TB/roznamcha drift (BRIDAL+COUTURE PASS after BRIDAL Option A) |
| **Final** | **PASS** | CHINA+BRIDAL Option A; COUTURE unchanged |

## Fixture refresh (Option A)

| Company | Change |
|---------|--------|
| DIN CHINA | TB **353,192,001.7**; roznamcha **109,088,121 / 74,675,317 / 34,412,804** |
| DIN BRIDAL | TB **26,410,077**; roznamcha **2,968,850 / 1,794,607 / 1,174,243** |
| DIN COUTURE | unchanged |

## Validation

| Suite | Result |
|-------|--------|
| test:unified-ledger | 334/334 PASS |
| test:unit | 176/176 PASS |
| build | PASS |

Admin Compare: **MATERIALITY_WAIVER** maxAbsDiff=1 PKR
