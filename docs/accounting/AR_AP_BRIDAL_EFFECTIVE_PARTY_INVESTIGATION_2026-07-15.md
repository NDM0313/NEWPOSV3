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

## Recommendation (not executed)

**B. Fix AR/AP comparison baseline** — gate production-complete on legacy vs unified **`official_gl`** (already PASS), keep EP as economic lens.

**Approval phrase required:** `APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL`

No runtime change, migration, or data mutation in this investigation.

## Status

AR/AP Phase 2b: still **NOT PRODUCTION COMPLETE** until that approval (or alternate approved path) lands.
