# AR/AP Bridal `effective_party` Investigation (2026-07-15)

**Scope:** OLD ERP DIN BRIDAL parity gap only (read-only)
**Evidence:** [`reports/ar-ap-phase-2b-bridal-effective-party-investigation-20260715/`](../../reports/ar-ap-phase-2b-bridal-effective-party-investigation-20260715/)

## Confirmed parity

| Basis | COUTURE | CHINA | BRIDAL |
|-------|---------|-------|--------|
| effective_party | PASS | PASS | **FAIL** (Δ 80,150) |
| official_gl | PASS | PASS | **PASS** |
| audit_full_history | PASS | PASS | **PASS** |

## Exact drivers (BRIDAL / effective_party)

| Delta | Contact | Source JE | Mechanism |
|------:|---------|-----------|-----------|
| 80,000 | Walk-in Customer old (`4549c5de…`) | **JE-0213** `correction_reversal` Dr AR 80k (voided pair JE-0204) | EP hides correction_reversal; legacy/OG keep orphan debit → **legacy overstates AR** |
| 150 | Walk-in Customer (`a3c6ea52…`) | **JV-000203** orphan-ar `gl_correction` | EP hides fingerprint; legacy includes → EP at 0 |

## Classification

- 80k: **LEGACY OVERSTATES AR** + **INTENTIONAL EFFECTIVE_PARTY EXCLUSION**
- 150: **INTENTIONAL EFFECTIVE_PARTY EXCLUSION** (independent)

## Recommendation — EXECUTED 2026-07-15

**B. Fix AR/AP comparison baseline** — **APPROVED** via `APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL`.

Runtime commit `a5149971` deployed to VPS. Operational basis remains `effective_party`; parity baseline is `official_gl`. No GL/data mutation.

Evidence: `reports/ar-ap-phase-2b-official-gl-parity-closeout-20260715/`

## Status

AR/AP Phase 2b: **PRODUCTION COMPLETE** (official_gl parity PASS ×3 + deploy + UI labels). Bridal `effective_party` variance remains intentional and documented.
