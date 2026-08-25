# Official Calendar Day 6 — 2026-07-06

**Classification:** **CALENDAR_STABILITY_DAY_PASS**

| Item | Value |
|------|--------|
| Run local date/time | 2026-07-06 12:56:34 → 13:10:15 +05:00 |
| Official stability window calendar day | **6** |
| Calendar days elapsed since 2026-07-01 | **5** |
| Monitoring artifact (final PASS) | `three-company-monitoring-2026-07-06T07-56-36-537Z` |
| Overall | **PASS** |

## Attempt history

| Attempt | Time (+05:00) | Result | Artifact |
|---------|---------------|--------|----------|
| 1 (blocked) | 12:27:35 → 12:38:26 | FAIL — DIN BRIDAL golden drift | `three-company-monitoring-2026-07-06T07-27-36-908Z` |
| 2 (after Option A fixture refresh) | 12:56:34 → 13:06:56 | **PASS** | `three-company-monitoring-2026-07-06T07-56-36-537Z` |

## Profile results (final PASS)

| Company | Result | Notes |
|---------|--------|-------|
| DIN CHINA | PASS | 19/19 checks; Admin Compare 9/9 |
| DIN BRIDAL | PASS | 18/19 + Admin Compare waived |
| DIN COUTURE | PASS | 18/19 + Admin Compare waived |

## Loader guard

**PASS** — read-only flag guard OK (8 loaders × 3 companies)

## Roznamcha

**Reached** — all three companies Roznamcha main loader unified PASS

## DIN BRIDAL fixture refresh (Option A — Nadeem approved)

Legitimate live-activity drift on first attempt. Fixture-only refresh applied (no GL mutation):

| Metric | Previous fixture (PKR) | Approved actual (PKR) |
|--------|------------------------|------------------------|
| Trial Balance total | 23,688,377 | **25,303,077** |
| Roznamcha Cash In | 2,507,350 | **3,335,850** |
| Roznamcha Cash Out | 1,164,607 | **1,294,607** |
| Roznamcha Closing | 1,342,743 | **2,041,243** |

MR REHAN ALI closing **530,000** — unchanged (PASS)

Files updated: `scripts/single-core-ledger/monitoring-company-profiles.json`, `reports/single-core-ledger/din-bridal/golden-fixtures.json`

## Validation

| Suite | Result |
|-------|--------|
| test:unified-ledger | 335/335 PASS |
| test:unit | 136/136 PASS |
| build | PASS |

## Accelerated sample note

Prior 2026-07-05 accelerated Day 6/7 samples remain extra evidence only and are **not** counted as official calendar days.

## Safety

| Gate | Status |
|------|--------|
| Classification | **CALENDAR_STABILITY_DAY_PASS** |
| Fixture refresh | Option A approved by Nadeem — fixture-only |
| R8 run | no |
| DB migrations | no |
| Repairs | no |
| GL mutation | no |
| Production data mutation | none |
| Play Store | no |
| Passwords committed | no |
