# Official Calendar Day 11 — 2026-07-07

**Classification:** **CALENDAR_STABILITY_DAY_PASS**

| Item | Value |
|------|--------|
| Run local date/time | 2026-07-07 19:04:35 → 19:17:30 +05:00 |
| Official stability window calendar day | **11** |
| Calendar days elapsed since 2026-07-01 | **10** |
| Monitoring artifact | `three-company-monitoring-2026-07-07T14-04-35-150Z` |
| Overall | **PASS** (fixture refresh retry after DIN CHINA drift) |

## Attempt history

| Attempt | Result | Notes |
|---------|--------|-------|
| 1 | FAIL | DIN CHINA live GL/roznamcha drift (TB 349.76M; post-clearance activity) |
| **Final** | **PASS** | China fixture-only refresh; bridal/couture unchanged |

## Profile results (final PASS)

| Company | Result |
|---------|--------|
| DIN CHINA | PASS 19/19 (Admin Compare **MATERIALITY_WAIVER** maxAbsDiff=1 PKR) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |

## Fixture refresh (Option A — DIN CHINA only)

| Metric | New golden (PKR) |
|--------|------------------|
| Trial Balance | **349,757,752.77** |
| Roznamcha Cash In | **109,088,121** |
| Roznamcha Cash Out | **74,675,317** |
| Roznamcha Closing | **34,412,804** |
| MR JALIL | unchanged **216,299** |

## Validation

| Suite | Result |
|-------|--------|
| test:unified-ledger | 334/334 PASS |
| test:unit | 176/176 PASS |
| build | PASS |

## Deploy

Frontend deploy to `erp.dincouture.pk` via `deploy/vps-build-erp-only.sh` @ `711d2307` (same session).
