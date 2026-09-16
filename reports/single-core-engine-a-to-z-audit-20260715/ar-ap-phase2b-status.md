# AR/AP Phase 2b — Deep Status

**Audit date:** 2026-07-15
**Primary evidence:** `reports/ar-ap-phase-2b-production-rollout-20260712/` + live SSH parity

## YES / NO gates

| Gate | YES/NO | Evidence |
|------|--------|----------|
| DEVELOPMENT COMPLETE | **YES** | `75c12cd7` |
| GITHUB COMPLETE | **YES** | pushed |
| MIGRATION COMPLETE | **YES** | applied 2026-07-11 21:36:11Z; RPC live 2026-07-15 |
| FRONTEND DEPLOYED | **YES** | VPS HEAD `5cf65f4c` includes wireup (was `aff7c1d3` at fail session) |
| PRODUCTION PARITY COMPLETE | **NO** | Bridal `effective_party` |
| PRODUCTION UI VERIFIED | **NO** | blocked by parity gate |
| PRODUCTION COMPLETE | **NO** | explicit |

## Component status

| Component | Status |
|-----------|--------|
| Migration | Applied / active |
| RPC | `get_unified_contact_party_gl_balances` live |
| Service layer | `arApUnifiedPartyBalanceService` / AR/AP center wired |
| UI | Live on prod build |
| Fallback | **RETAINED** → `get_contact_party_gl_balances` |
| Parity script | Exists; Windows bash spawn fails; SSH SQL used instead |
| DIN COUTURE `effective_party` | **PASS** (delta 0) live 2026-07-15 |
| DIN CHINA `effective_party` | **PASS** (delta 0) |
| DIN BRIDAL `effective_party` | **FAIL** sum_abs_delta **79850** |
| DIN BRIDAL `official_gl` | **PASS** |
| DIN BRIDAL `audit_full_history` | **PASS** |
| Walk-in Customer old | legacy AR 171500 → unified 91500 (**Δ 80000**) |
| Walk-in Customer | legacy AR −150 → unified 0 (**Δ −150**) |
| Contacts page | Still legacy RPC — **not switched** |
| Exception queues / repair / control GL / op totals | Unchanged per Phase 2b addendum |

## Classification

- DEVELOPMENT COMPLETE: YES
- GITHUB COMPLETE: YES
- MIGRATION COMPLETE: YES
- FRONTEND DEPLOYED: YES
- PRODUCTION PARITY COMPLETE: **NO**
- PRODUCTION UI VERIFIED: **NO**
- PRODUCTION COMPLETE: **NO**

## Exact blocker

DIN BRIDAL default basis `effective_party` party-GL parity vs legacy Contacts RPC — Walk-in Customer old Rs. 80,000 dominant. Do not claim production-complete until bridal PASS or operator changes basis/approval for alternate path.

## Scope note

AR/AP Phase 2b is a **Single Core extension**, not original eight-screen core.
