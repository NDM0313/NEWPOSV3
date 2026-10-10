# Bridal effective_party Investigation — Final Report

**Date:** 2026-07-15

## Verdict

DIN BRIDAL `effective_party` FAIL (Δ 80,150) is **fully explained**:

1. **Rs. 80,000** — JE-0213 `correction_reversal` orphan debit after voided JE-0204 → **legacy overstates AR**; EP exclusion intentional/economic.
2. **Rs. 150** — JV-000203 orphan-ar `gl_correction` → **intentional EP exclusion**.

`official_gl` / `audit_full_history` **PASS** vs legacy.

## Recommendation

**B — Fix AR/AP comparison baseline** to `official_gl` for the production-complete gate.
Approval: `APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL`
No runtime/data changes in this investigation.

## Status

AR/AP Phase 2b remains **NOT PRODUCTION COMPLETE** until operator approves baseline/UI follow-up.
