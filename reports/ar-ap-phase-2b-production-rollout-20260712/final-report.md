# AR/AP Phase 2b — Production rollout final report

**Project:** OLD ERP / DIN Collection ERP (NEWPOSV3)
**Date:** 2026-07-12
**Operator gate:** Migration not approved

## Status labels

| Label | Status |
|-------|--------|
| DEVELOPMENT COMPLETE | yes |
| GITHUB PUSHED | pending → completed in this session |
| MIGRATION NOT APPROVED | yes |
| MIGRATION APPLIED | no |
| PRODUCTION PARITY PASS | no (SKIP_RPC_NOT_DEPLOYED) |
| FALLBACK RETAINED | yes |

## Commits

| Commit | Role |
|--------|------|
| `75c12cd7` | Phase 2b runtime + migration + tests + wireup evidence |
| rollout evidence commit | Production rollout MD/TXT evidence + doc status updates |

## What was delivered

1. **Additive RPC** `get_unified_contact_party_gl_balances` — unified basis + branch rules, legacy-compatible columns.
2. **Service** `arApUnifiedPartyBalanceService.ts` — feature-flagged unified path with kill-switch and missing-RPC fallback.
3. **UI** AR/AP Diagnostics banners, admin parity chip, Payables variance explainer labels.
4. **Tests** 339 unified + 189 unit — all PASS locally.
5. **Read-only parity script** — pre-migration `SKIP_RPC_NOT_DEPLOYED` (expected).

## What was NOT done (by design)

- Production migration apply
- GL mutation or repair scripts
- VPS frontend deploy of Phase 2b runtime (optional after migration approval)
- Removal of legacy `get_contact_party_gl_balances` fallback
- Changes to exception queues, hybrid repair, Contacts page

## Remaining blocker for production complete

Operator must provide exact approval phrase:

`APPROVE_AR_AP_PHASE2B_UNIFIED_RPC_PRODUCTION_MIGRATION`

Then:

1. Apply only `migrations/20260712120000_get_unified_contact_party_gl_balances.sql`
2. Re-run parity script — expect PASS for DIN COUTURE, DIN BRIDAL, DIN CHINA
3. Deploy Phase 2b frontend to VPS if not already on `75c12cd7+`
4. Verify AR/AP Diagnostics unified banner + admin parity chip in production

## Evidence folder

`reports/ar-ap-phase-2b-production-rollout-20260712/`

Files not created (migration not approved):

- `migration-apply.txt`
- `post-migration-rpc-status.txt`
- `post-migration-parity.txt`
- `monitoring.txt` (post-migration)
