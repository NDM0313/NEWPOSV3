# Single Core Engine — Exact Scope Matrix

**Audit date:** 2026-07-15
**Authorities:** `SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md` (historical), master plan v3, R8-R1 execution, closeout 2026-07-12

## Intended core scope (money report loaders)

Official eight-screen unified main-loader set for DIN CHINA / DIN BRIDAL / DIN COUTURE:

1. Ledger V2
2. Account Statement
3. Trial Balance
4. Party Ledger
5. Roznamcha
6. Cash Flow
7. Balance Sheet
8. Profit & Loss

Supporting core architecture: feature flags, engine state, kill switch, resolvers, Admin Compare / monitoring / golden fixtures, L0–L2 rollback.

## Classification

| Module | Classification | Notes |
|--------|----------------|-------|
| Ledger V2 | CORE SINGLE CORE ENGINE | Loader flags ON in prod |
| Account Statement | CORE SINGLE CORE ENGINE | Same |
| Trial Balance | CORE SINGLE CORE ENGINE | Same |
| Party Ledger | CORE SINGLE CORE ENGINE | Same |
| Roznamcha | CORE SINGLE CORE ENGINE | Same |
| Cash Flow | CORE SINGLE CORE ENGINE | Phase 3B-M |
| Balance Sheet | CORE SINGLE CORE ENGINE | Phase 3D |
| Profit & Loss | CORE SINGLE CORE ENGINE | Phase 3D |
| Unified engine state / flags / kill switch | CORE SINGLE CORE ENGINE | Triple-gate |
| Loader resolvers | CORE SINGLE CORE ENGINE | Keep for rollback |
| Monitoring profiles / goldens / loader guard | CORE SINGLE CORE ENGINE | Ops contract |
| Admin Compare / Tie-out | DIAGNOSTIC / SHADOW COMPARE | Not end-user money path |
| AR/AP Reconciliation Center Phase 2b | SINGLE CORE EXTENSION | Explicit Phase 2b in rollout plan — not original eight-screen closeout |
| Contacts page party GL | OUTSIDE SCOPE (optional follow-up) | Still legacy RPC; called out in closeout |
| Mobile app salesmen / Play Store | OUTSIDE SCOPE | QA complete; release skipped; **not core blocker** |
| Customer ledger hybrid `getCustomerLedger` | LEGACY DEPENDENCY | Fallback / Phase 8 out of R8-R2 |
| Dashboards using `getTrialBalance` / legacy | LEGACY DEPENDENCY | Must retain per R8-R2 plan |
| FX / multi-currency exchange app | OUTSIDE SCOPE | Explicitly excluded from this audit |
| Phase 8 broad table/UI retirement | FUTURE PHASE | Distinct from R8-R2 thin-wrapper deletion |
| AR/AP Integrity Lab queues / repair apply | OUTSIDE SCOPE / FUTURE | Control apply Phase 3 blocked historically |

## AR/AP Phase 2b relative to Single Core Engine

| Question | Answer |
|----------|--------|
| Part of original eight-screen Single Core closeout? | **NO** |
| Optional / scheduled extension? | **YES** — Phase 2b in Phase 2 rollout inventory |
| Dependency of core operational completion? | **NO** — core can be operationally complete with AR/AP incomplete |
| Separate post-closeout enhancement? | **YES** for production-complete status |
| Blocks technically closed program? | Contributes to **NO** on technical closeout if program definition includes extensions; this audit treats it as **extension incomplete**, core still operationally complete |

## Out-of-scope explicit exclusions (this audit)

Unrelated mobile IPA/APK WIP, Roznamcha cosmetic WIP beyond SCE loaders, graphify-out, import-gap repair SQL, temp scripts, backups, FX app.
