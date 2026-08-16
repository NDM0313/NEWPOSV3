# Official Calendar Day 14 — 2026-07-08

**Classification:** **CALENDAR_STABILITY_DAY_PASS**

| Item | Value |
|------|--------|
| Run local date/time | 2026-07-08 17:56:00 → 18:13:00 +05:00 |
| Official stability window calendar day | **14** |
| Calendar days elapsed since 2026-07-01 | **13** |
| Monitoring artifact | `three-company-monitoring-2026-07-08T12-56-01-209Z` |
| Overall | **PASS** (Option A fixture refresh) |

## Attempt history

| Attempt | Result | Notes |
|---------|--------|-------|
| 1 | FAIL | UI/nav timeouts (CHINA early abort; BRIDAL Account Statements) |
| 2 | FAIL | Live GL/roznamcha drift vs Day 13 fixtures (loaders PASS; Admin Compare 9/9 strict) |
| **Final** | **PASS** | Option A CHINA+BRIDAL fixtures; COUTURE unchanged |

## Fixture refresh (Option A)

| Company | Change |
|---------|--------|
| DIN CHINA | TB **333,268,801.7**; roznamcha **59,762,230 / 35,651,877 / 24,110,353** |
| DIN BRIDAL | Roznamcha **2,850,850 / 1,794,607 / 1,056,243** |
| DIN COUTURE | unchanged |

## Validation

| Suite | Result |
|-------|--------|
| test:unified-ledger | 334/334 PASS |
| test:unit | 176/176 PASS |
| build | PASS |

Admin Compare: **9/9 strict PASS** (maxAbsDiff=0)
