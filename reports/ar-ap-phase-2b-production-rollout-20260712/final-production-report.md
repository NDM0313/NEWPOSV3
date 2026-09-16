# AR/AP Phase 2b — Production completion blocked

**Date:** 2026-07-12  
**Approval phrase received:** `APPROVE_AR_AP_PHASE2B_UNIFIED_RPC_PRODUCTION_MIGRATION`  
**Verdict:** **NOT PRODUCTION COMPLETE** — DIN BRIDAL parity FAIL under Phase 2b default basis `effective_party`

## Status labels

| Label | Status |
|-------|--------|
| DEVELOPMENT COMPLETE | yes (`75c12cd7`) |
| GITHUB COMPLETE | yes |
| MIGRATION APPLIED | yes (already on prod since 2026-07-11 21:36:11Z) |
| PRODUCTION PARITY PASS | **no** — DIN BRIDAL FAIL |
| FRONTEND DEPLOYED | yes (pre-existing VPS build `aff7c1d3`) — **this session did not deploy** |
| PRODUCTION UI VERIFIED | **blocked** by parity gate |
| LEGACY FALLBACK RETAINED | yes |
| PRODUCTION COMPLETE | **no** |

## Parity summary

| Company | Result | Max delta |
|---------|--------|-----------|
| DIN COUTURE | PASS | 0 |
| DIN BRIDAL | **FAIL** | **79850** AR |
| DIN CHINA | PASS | 0 |

DIN BRIDAL drivers (effective_party):

- Walk-in Customer old (`4549c5de-…`): legacy AR 171500 → unified 91500 (Δ −80000)
- Walk-in Customer (`a3c6ea52-…`): legacy AR −150 → unified 0 (Δ +150)

Same company **PASS** with `official_gl` and `audit_full_history` (delta 0).

## Safety actions taken

- No journal / account / balance mutation
- No other migrations applied
- No kill-switch toggle
- No R8-R2 / Play Store work
- No frontend rebuild in this session after FAIL

## Recommended next operator choices (pick one)

1. **Investigate** Walk-in Customer old effective_party exclusion (Rs 80,000) — read-only JE attribution — then re-run parity.
2. **Approve** a follow-up runtime change to use `official_gl` for AR/AP Diagnostics party GL (code change; not done here).
3. **Approve** temporary kill-switch / loader-off for DIN BRIDAL only until parity PASS (not done; requires explicit phrase).
4. **Approve** frontend rollback to `8bbb01f0` if Phase 2b UI must be removed until bridal PASS.

## Evidence

`reports/ar-ap-phase-2b-production-rollout-20260712/`
