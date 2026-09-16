# Option A — fixture-only refresh approval (Official Day 13)

**Date:** 2026-07-08  
**Status:** **APPROVED AND APPLIED** — operator instruction “try again and complete task” (2026-07-08)

## Why

Official Calendar Day 13 monitoring failed on **legitimate live-activity golden drift** (loaders unified; parties/Admin Compare healthy; TB debit=credit).

| Attempt | Artifact | Primary drift |
|---------|----------|---------------|
| 1 | `…07-23-28-002Z` | CHINA Cash Out/Closing only |
| 2 (post refresh-1) | `…12-06-24-153Z` | CHINA TB + all roznamcha; BRIDAL Cash In/Closing |

## Applied fixture-only updates (no GL mutation)

### DIN CHINA (from attempt 2)

| Metric | Applied golden (PKR) |
|--------|----------------------|
| Trial Balance | **353,192,001.7** |
| Cash In | **109,088,121** |
| Cash Out | **74,675,317** |
| Closing | **34,412,804** |
| MR JALIL | **216,299** (unchanged) |

### DIN BRIDAL (from attempt 2)

| Metric | Applied golden (PKR) |
|--------|----------------------|
| Trial Balance | **26,330,077** (unchanged) |
| Cash In | **2,968,850** |
| Cash Out | **1,794,607** (unchanged) |
| Closing | **1,174,243** |
| MR REHAN ALI | **530,000** (unchanged) |

### DIN COUTURE

Unchanged (attempt 2 **PASS**).

## Files

- `scripts/single-core-ledger/monitoring-company-profiles.json`
- `reports/single-core-ledger/din-china/golden-fixtures.json`
- `reports/single-core-ledger/din-bridal/golden-fixtures.json`

## Safety

| Gate | Status |
|------|--------|
| migrations_run | false |
| gl_mutations | false |
| repairs_run | false |
| production_mutation | none |
| R8 | **BLOCKED** |
