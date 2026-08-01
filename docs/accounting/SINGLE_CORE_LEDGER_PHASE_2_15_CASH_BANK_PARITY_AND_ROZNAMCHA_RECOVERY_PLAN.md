# Phase 2.15 — Cash/Bank Parity & Roznamcha Recovery

**Status:** `PHASE 2.16 MONITORING PASS — DIN CHINA unified reporting live, monitored, automation hardened`  
**Company:** DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485`  
**Date:** 2026-06-27  
**Commit:** `b8b093f7` (parity fix) + Phase 2.16 monitoring pack

---

## Summary

Phase 2.14 failed because the unified Roznamcha loader mapped raw `get_unified_cash_bank_ledger` GL rows to cashbook totals. Legacy Roznamcha uses a **payment + journal-only composite** with JE-level dedupe — not pure GL.

Phase 2.15 fixed the unified main loader to use `assembleRoznamchaUnifiedParityMain` (parity engine = `getRoznamcha`), added diagnostic/classification artifacts, and re-enabled Roznamcha loader after golden gate PASS.

## Root cause

| Issue | Impact |
|-------|--------|
| Payment-posted GL legs (`payment_id` set) | +~68.5M unified cash_out vs legacy |
| Document expense/sale/purchase GL on liquidity | Double-count vs payment path |
| No JE-level dedupe on unified RPC | Transfer pairs inflate unified totals |
| Raw RPC mapper in 2.14 | Closing 8,882,313 vs golden 69,115,586 |

**SQL identity (wide range):**

```
legacy cash_in  = payments (55,305,771) + journal-only dr (80,852,241) = 136,158,012
legacy cash_out = payments only (67,042,426)
```

## Fix (reporting logic only)

| File | Change |
|------|--------|
| `roznamchaUnifiedParityAssembler.ts` | New — parity main loader |
| `roznamchaUnifiedParityFilter.ts` | New — document/payment exclusion helpers |
| `roznamchaUnifiedMainService.ts` | Route to parity assembler (not raw RPC mapper) |

**Migration required:** No.

## Before / after totals (wide range)

| Metric | Legacy golden | Phase 2.14 unified | Phase 2.15 unified |
|--------|---------------|--------------------|--------------------|
| Cash In | 136,158,012 | 135,736,321 | **136,158,012** |
| Cash Out | 67,042,426 | 126,854,008 | **67,042,426** |
| Closing | 69,115,586 | 8,882,313 | **69,115,586** |

## Production state (final)

| Flag | State |
|------|-------|
| `unified_ledger_loader_roznamcha` | **ON** |
| `unified_ledger_screen_roznamcha` | **ON** |
| LV2 / AS / TB / PL loaders | ON (unchanged) |

## Evidence

`reports/single-core-ledger/phase-2-15-cash-bank-parity/`

## Blocked / deferred

- Admin Compare Cash/Bank raw RPC vs legacy — remains shadow diagnostic with existing waiver
- Optional `roznamcha_payment` RPC mode (migration) if pure GL path desired without composite
- **Other companies:** expansion requires separate finance sign-off — do not enable flags without approval

## Closeout (2.15X)

- Commit `b8b093f7` pushed to `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan`
- Evidence: `reports/single-core-ledger/phase-2-15-cash-bank-parity/phase-215x-final-closeout.md`
- Monitoring: `phase-215x-24h-monitoring-checklist.md`
- Automation waivers: `phase-215x-waiver-note.md` (LV2 Playwright NaN, Admin Compare timing) — **resolved in Phase 2.16**

## Phase 2.16 — Monitoring and automation hardening

- **Status:** `PHASE 2.16 MONITORING PASS — DIN CHINA UNIFIED LEDGER STABLE`
- Production verification: all five unified main loaders ON; golden totals unchanged
- Automation fixes: shared Playwright helpers (`unifiedLedgerBrowserQaHelpers.mjs`); LV2 MR JALIL and Admin Compare 9/9 stable
- No flags changed; no other company expansion
- Evidence: `reports/single-core-ledger/phase-2-16-monitoring/`
- Expansion readiness: [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md)
