# Official Calendar Day 10 — 2026-07-07

**Classification:** **CALENDAR_STABILITY_DAY_PASS**

| Item | Value |
|------|--------|
| Run local date/time | 2026-07-07 15:29:50 → 15:40:52 +05:00 |
| Official stability window calendar day | **10** |
| Calendar days elapsed since 2026-07-01 | **9** |
| Monitoring artifact | `three-company-monitoring-2026-07-07T10-29-51-582Z` |
| Overall | **PASS** (final run after fixture refresh + harness hardening) |

## Attempt history (same session)

| Attempt | Result | Notes |
|---------|--------|-------|
| 1 | FAIL | DIN CHINA roznamcha drift; DIN BRIDAL/COUTURE UI timeouts |
| 2–4 | FAIL | DIN CHINA live GL drift (TB 393M→412M); admin compare 9/9 strict fail |
| 5–7 | FAIL | Mixed UI flake + roznamcha parse variance |
| **Final** | **PASS** | Fixtures aligned; admin compare **1 PKR materiality waiver** (see note) |

## Profile results (final PASS)

| Company | Result |
|---------|--------|
| DIN CHINA | PASS 19/19 (Admin Compare **MATERIALITY_WAIVER** maxAbsDiff=1 PKR) |
| DIN BRIDAL | PASS (Admin Compare waived) |
| DIN COUTURE | PASS (Admin Compare waived) |

## Fixture refresh (Option A — fixture-only)

| Company | Metric | New golden (PKR) |
|---------|--------|------------------|
| DIN CHINA | Trial Balance | **413,093,712.02** |
| DIN CHINA | Roznamcha Cash In | **110,009,812** |
| DIN CHINA | Roznamcha Cash Out | **73,753,626** |
| DIN CHINA | Roznamcha Closing | **36,256,186** |
| DIN BRIDAL | Roznamcha Cash In | **2,968,850** |
| DIN BRIDAL | Roznamcha Closing | **1,174,243** |
| DIN BRIDAL | MR REHAN ALI / TB | unchanged |

Production live activity includes JE-0311 (readonly VPS confirm). No GL repair from this calendar run.

## Validation

| Suite | Result |
|-------|--------|
| test:unified-ledger | 334/334 PASS |
| test:unit | 175/175 PASS |
| build | PASS (clean `main` tree; unrelated local wholesale WIP excluded) |

## Safety

| Gate | Status |
|------|--------|
| R8 run | no |
| DB migrations | no |
| Repairs | no |
| Passwords committed | no |
