# Single Core Ledger — R7 roznamcha_payment RPC (design only)

**Status:** DESIGN ONLY — no migration apply  
**Date:** 2026-06-27

---

## Purpose

Optional additive RPC path for payment-linked roznamcha rows if pure GL journal-path mode is insufficient for a future company rollout.

---

## Current state

DIN CHINA roznamcha unified main loader uses **parity assembler** (`assembleRoznamchaUnifiedParityMain`) — journal-path filter + payment supplement. Production golden values match legacy roznamcha UI, not raw `get_unified_cash_bank_ledger` closings.

---

## Proposed RPC mode (future)

| Field | Detail |
|-------|--------|
| Name | `get_unified_cash_bank_ledger` extension or sibling `roznamcha_payment` basis |
| Behavior | Include payment-linked rows with same economic keys as legacy roznamcha |
| Scope | Additive migration under `migrations/` — **not applied** |
| Consumers | Shadow compare only until finance approves |

---

## Gates before implementation

1. Finance sign-off on roznamcha semantic change
2. Per-company golden capture with parity totals
3. Shadow compare PASS vs legacy for target company
4. DIN CHINA regression PASS (no loader semantic change without waiver)

---

## Explicit stop

Do **not** apply migration or change DIN CHINA live roznamcha loader without separate approved phase.
