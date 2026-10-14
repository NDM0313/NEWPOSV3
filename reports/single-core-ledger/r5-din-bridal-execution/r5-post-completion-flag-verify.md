# R5 DIN BRIDAL — Post-completion flag verify (read-only)

**Run:** R5 DIN BRIDAL POST-COMPLETION ARCHIVE  
**Date:** 2026-06-27T17:26:05Z  
**Method:** Read-only SQL via VPS — `scripts/single-core-ledger/din-bridal/r5-monitoring-flags-pipe.sql`  
**Status:** PASS

---

## DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)

| Check | Expected | Actual |
|-------|----------|--------|
| Unified flags ON | 12/12 | **12/12** |
| Main loaders ON | 5/5 | **5/5** |

**Flags ON:** `unified_ledger_pilot`, `unified_ledger_engine`, 5× screen preview, 5× main loaders (Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha).

---

## DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`) — regression

| Check | Expected | Actual |
|-------|----------|--------|
| Unified flags ON | 12/12 | **12/12** |
| Main loaders ON | 5/5 | **5/5** |

DIN CHINA unchanged — no regression.

---

## Cross-company leakage

| Check | Expected | Actual |
|-------|----------|--------|
| Other-company unified loaders ON | 0 | **0** |

Only DIN CHINA and DIN BRIDAL have unified ledger flags in production.

---

## Constraints

- Read-only SELECT — no flag mutations
- No migrations, GL changes, or FX app involvement
