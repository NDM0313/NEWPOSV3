# R2 — Admin Compare Cash/Bank findings

**Date:** 2026-06-27  
**Company:** DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

---

## What Admin Compare Cash/Bank compares

| Side | Engine | Shadow? |
|------|--------|---------|
| **Old** | `roznamchaService.getRoznamcha` (+ compare-only `manual_receipt` GL supplement) | Legacy cashbook composite |
| **New** | `get_unified_cash_bank_ledger` via `getUnifiedCashBankLedger({ shadowForce: true })` | Raw unified GL liquidity lines |

**Basis:** `official_gl` fixed (`CASH_BANK_COMPARE_BASIS`) — roznamcha has no effective_party lens.

**Implementation:** `compareCashBankLedgerTieOut` in `unifiedLedgerCashBankCompareService.ts` → `evaluateCashBankComparePass` in `roznamchaCashBankCompareMappers.ts`.

---

## Is the comparison semantically fair?

**No — by design.** The tab compares:

1. **Operational roznamcha cashbook** — payments, expenses, transfers aggregated for UX; period opening from cashbook logic.
2. **Raw unified GL cash/bank RPC** — all journal lines on liquidity accounts, including payment-posted document GL legs excluded from roznamcha parity.

Documented deltas (Phase 2.9A-CB investigation):

- Closing totals can differ by millions PKR (e.g. ~−4M on DIN CHINA wide range) while **row parity** can still PASS after economic-key matching.
- Row counts often differ (e.g. 138 legacy vs 151 unified) before supplements; `manual_receipt` supplement aligns compare-only legacy side.

This is **not** a production parity failure for DIN CHINA Roznamcha loader.

---

## What live Roznamcha loader uses

**Not** raw `get_unified_cash_bank_ledger` as main data.

Live unified main path: `assembleRoznamchaUnifiedParityMain` (`roznamchaUnifiedParityAssembler.ts`):

- **Main rows/totals:** `getRoznamcha` (payment + journal composite) — `parityEngine: 'roznamcha_payment_journal_composite'`
- **Attached unified rows:** filtered via `filterUnifiedRowsForRoznamchaJournalPath` / `roznamchaUnifiedParityFilter.ts` for preview metadata — excludes payment-linked document GL legs

Phase 2.15 parity fix + Phase 2.16 monitoring confirmed production golden totals PASS.

---

## Pass/fail semantics (before R2 UI fix)

Logic was already correct in code:

- `pass = rowParityPass` only (not closing balance)
- `periodMovementPass` tracked separately but not shown in UI
- UI showed large "Difference" on balance cards without explaining informational nature → **operator confusion**

---

## R2 resolution approach

**CLOSED_SAFE_DIAGNOSTIC_FIX** — Admin Compare UI/service labeling only:

- Banner explaining shadow diagnostic vs production parity assembler
- Relabel new engine as "Raw GL diagnostic — not Roznamcha parity"
- Expose `rowParityPass` / `periodMovementPass` / supplement count in UI
- Export `cashBankDiagnostic` metadata in compare JSON

**Not required:** migration, RPC change, live loader change, or raw GL as roznamcha main.

---

## Optional future work (blocked without approval)

- `roznamcha_payment` RPC mode — migration approval required
- Aligning roznamcha production to raw GL — would be live loader / accounting change — **out of R2 scope**
