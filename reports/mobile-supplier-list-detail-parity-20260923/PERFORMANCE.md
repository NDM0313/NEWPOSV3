# PERFORMANCE — Supplier Business GL batch (list)

**Date:** 2026-09-23  
**Scope:** Mobile Supplier Ledger list refresh (company-wide / null branch)

## Before fix

| Call site | Business batch |
|-----------|----------------|
| `getContacts(... supplier ...)` | 1× `loadSupplierBusinessGlBalancesMap` |
| `PartyLedgerReport` supplier branch | 1× **same** batch again |
| **Total per list refresh** | **2× full journal-line scans** |

Silent-zero catch made a failed second pass overwrite balances with 0.

## After fix

| Call site | Business batch |
|-----------|----------------|
| `getContacts(... supplier ...)` | 1× `loadSupplierBusinessGlBalancesMap` |
| `PartyLedgerReport` supplier branch | **0** (trusts `Contact.balance`) |
| **Total per list refresh** | **1×** |

Detail open still uses per-contact `loadSupplierBusinessHistory` (unchanged; one supplier).

## Batch shape (unchanged algorithm)

- Accounts: all company accounts; IDs selected when `linked_contact_id` ∈ supplier/both contacts, plus verified remap ends.
- Line fetch: `fetchInChunks` chunkSize **25**, concurrency **3**, page size **1000**.
- Dedup: `journal_line_id` via `seen` Set.
- Result meta: `{ accountCount, lineCount, supplierCount, durationMs }`.

## RO audit footprint (DIN COLLECTION, same model as BEFORE CSV)

| Metric | Value |
|--------|------:|
| Supplier contacts audited | 128 |
| Non-zero Business suppliers | 79 |
| TRUE_ZERO (no Business lines) | 15 |
| Class B (Official AP 0, Business ≠ 0) | 59 |

Exact live `accountCount` / `lineCount` / wall `durationMs` are returned by `meta` on each successful mobile load (device not instrumented this pass).

## Not done

- No N-supplier sequential network calls for list.
- No Graphify update.
- No APK install / device timing.
