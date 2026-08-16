# Phase 2.16 — Company expansion readiness summary

**Date:** 2026-06-27  
**Action:** Readiness pack only — **no flags enabled, no expansion started.**

---

## Current production scope

| Item | State |
|------|-------|
| Live unified company | **DIN CHINA only** |
| Unified main loaders live | Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha |
| Other company loader flags | **0 enabled** (verified 2026-06-27) |
| Phase 2.16 monitoring | **PASS** |

---

## Expansion prerequisites (future companies)

Before enabling any non–DIN CHINA company:

1. **Finance sign-off** per company (dedicated approval record)
2. **Company-specific golden fixtures** — do not reuse DIN CHINA MR JALIL / Roznamcha / TB totals
3. **Per-screen golden verification** before each loader flag
4. **24h monitoring** or signed accelerated waiver after final loader
5. **Rollback SQL** staged per loader (Phase 2.10–2.14 scripts)
6. **Operator approval** before each enable step
7. **Cross-company flag audit** — confirm no stray loader flags on other companies

Full checklist: [`docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md)

---

## DIN CHINA golden reference (not portable)

| Fixture | Value |
|---------|-------|
| MR JALIL (LV2 / AS / PL) | PKR 216,300 |
| Trial Balance debit = credit | PKR 407,957,271.02 |
| Roznamcha Cash In / Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 |

---

## Recommended next step (when approved)

1. Select target company and obtain finance sign-off
2. Capture golden fixtures on legacy loaders (wide date range)
3. Enable pilot + engine + screen flags only; run Admin Compare
4. Enable loaders one at a time with monitoring script adapted for that company
5. Run 24h monitoring window before declaring live

**Phase 2.16 does not execute any of the above.**
