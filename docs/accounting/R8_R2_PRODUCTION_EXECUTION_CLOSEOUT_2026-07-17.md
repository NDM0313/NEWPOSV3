# R8-R2 Production Execution Closeout — 2026-07-17

**Scope:** OLD ERP / DIN Collection ERP only  
**Operator directive:** skip date gate and complete remaining task

---

## Executed

| Step | Result |
|------|--------|
| Date gate | **WAIVED** |
| Rebase rehearsal onto main | PASS → tip `390f922c` |
| test:unified-ledger | **350/350 PASS** |
| test:unit | **188/188 PASS** |
| build | **PASS** |
| Pre-delete tag | `r8-r2-pre-code-deletion-20260717` → `17a6c131` |
| Merge to main | Fast-forward `17a6c131..390f922c` |
| Deploy | `deploy/vps-build-erp-only.sh` via `ssh dincouture-vps` |
| Production HTTP | **200** |
| erp-frontend | **healthy** @ `812c2871` (includes deletion `390f922c`) |
| Wrappers on VPS | **absent** |
| Post-deploy verification | See [`R8_R2_PRODUCTION_VERIFICATION_2026-07-17.md`](R8_R2_PRODUCTION_VERIFICATION_2026-07-17.md) |

## Deleted in production

- 4× `*LegacyMainService.ts` thin wrappers
- Page legacy main branches: AS, TB, Party, Roznamcha, LV2, Cash Flow
- Fail-closed via `assertUnifiedMainLoaderSource`

## Retained

Shadow compare · getCustomerLedger · Contacts · mobile · resolvers · flags · kill · L1 SQL · loader guard · BS/P&L error fallback

## Kill switch

- Production kill: **NOT toggled** (remains OFF)
- Local static resolver/kill tests: PASS
- Post-deletion semantics: kill ON → resolver `legacy` → pages **fail closed** (use L2 tag rollback, not kill, to restore UI)

## Monitoring

- Loader guard: PASS
- Playwright three-company (verification retry 2026-07-17): bridal/couture PASS; china FAIL on MR JALIL golden drift (live 66299 vs fixture 116299) with **loaders unified** + pilot batch 9/9 PASS — goldens not changed; no rollback
- Production health: HTTP 200 + container healthy confirmed @ `VITE_BUILD_COMMIT=812c2871`

## Rollback

1. `git checkout r8-r2-pre-code-deletion-20260717` (or revert `390f922c`)
2. Redeploy frontend only
3. Do **not** rely on L1 flags alone

## Status

| State | Value |
|-------|--------|
| Single Core operationally complete | YES |
| Approved main-loader legacy retired (A1+A2) | **YES** |
| BS/P&L fallback retired | **NO** (deferred) |
| `R8_R2_PRODUCTION_VERIFIED_COMPLETE` | **YES** |
| `SINGLE_CORE_ENGINE_TECHNICALLY_CLOSED` | **YES** |
| `SINGLE_CORE_ENGINE_FULLY_RETIRED_FOR_APPROVED_SCOPE` | **YES** |
| Fully retired (entire R8-R2 incl. BS/P&L) | **NO** — BS/P&L second wave remains |
