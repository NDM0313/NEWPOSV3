# R8 Legacy Retirement — Affected Surface Inventory (Read-Only)

**Date:** 2026-07-10  
**Project:** OLD ERP / DIN Collection ERP only (not FX app)  
**Repo:** NEWPOSV3 @ `2dee1163`  
**R8 executed:** no

---

## R8 docs and runbooks (canonical order)

| Priority | Path | Role |
|----------|------|------|
| 1 | [`docs/accounting/R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md`](../../docs/accounting/R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md) | Post–Day 15 preflight + approval gate |
| 2 | [`docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md`](../../docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md) | Retirement inventory + safe order |
| 3 | [`reports/remaining-tasks-start-20260630/r8-legacy-retirement-plan.md`](../remaining-tasks-start-20260630/r8-legacy-retirement-plan.md) | High-level plan (`BLOCKED_PENDING_STABLE_RUN_AND_FINAL_APPROVAL`) |
| 4 | [`reports/single-core-ledger/post-baseline-remaining-phases/r8-retirement-readiness.md`](../single-core-ledger/post-baseline-remaining-phases/r8-retirement-readiness.md) | Blockers + L1 rollback refs |
| 5 | [`docs/accounting/FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md`](../../docs/accounting/FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md) | Program calendar + R8 gate |
| 6 | [`reports/single-core-ledger/final-program-archive/r7-r8-gate-status.md`](../single-core-ledger/final-program-archive/r7-r8-gate-status.md) | R7 design-only / R8 blocked archive |

**Note:** No single `execute-r8.sh` script exists. R8 is a **code + flag retirement** program guided by docs; execution steps must follow approved runbook sequence after operator phrase.

---

## R8-related scripts (do not auto-run)

| Script | Purpose | R8 execution? |
|--------|---------|---------------|
| [`scripts/single-core-ledger/run-three-company-operational-monitoring.mjs`](../../scripts/single-core-ledger/run-three-company-operational-monitoring.mjs) | Post-change smoke / Admin Compare | **No** — validation only |
| [`scripts/single-core-ledger/generate-calendar-stability-evidence.mjs`](../../scripts/single-core-ledger/generate-calendar-stability-evidence.mjs) | Calendar evidence markdown | **No** |
| [`scripts/single-core-ledger/threeCompanyLoaderGuard.test.mjs`](../../scripts/single-core-ledger/threeCompanyLoaderGuard.test.mjs) | Loader guard unit tests | **No** |
| `scripts/single-core-ledger/phase-21x-rollback-*.sql` | DIN CHINA L1 loader rollback | **Rollback only** — not R8 forward |
| `scripts/single-core-ledger/din-bridal/db-rollback-*.sql` | DIN BRIDAL L1 rollback | **Rollback only** |
| `scripts/single-core-ledger/din-couture/dc-rollback-*.sql` | DIN COUTURE L1 rollback | **Rollback only** |

Pre-retirement scan examples (from plan doc):

```bash
rg "getCustomerLedger|legacy_shadow|hybrid" src/ erp-mobile-app/
rg "unified_ledger_loader" src/app/config/
```

---

## Feature flags (`feature_flags` table + env)

Constants: [`src/app/lib/unifiedLedgerFlagKeys.ts`](../../src/app/lib/unifiedLedgerFlagKeys.ts)

| Key | Scope | R8 impact |
|-----|-------|-----------|
| `unified_ledger_engine` | Company | Master engine gate |
| `unified_ledger_kill_switch` | Company / env | Forces legacy loaders (L0 rollback) |
| `unified_ledger_pilot` | Company | Pilot / compare flows |
| `unified_ledger_loader_ledger_v2` | Company | Ledger V2 main loader swap |
| `unified_ledger_loader_account_statement` | Company | Account Statement main loader |
| `unified_ledger_loader_trial_balance` | Company | Trial Balance main loader |
| `unified_ledger_loader_party_ledger` | Company | Party Ledger main loader |
| `unified_ledger_loader_roznamcha` | Company | Roznamcha main loader |
| `unified_ledger_loader_cash_flow` | Company | Cash Flow main loader |
| `unified_ledger_loader_balance_sheet` | Company | Balance Sheet main loader |
| `unified_ledger_loader_profit_loss` | Company | P&L main loader |
| `unified_ledger_screen_*` (8 screens) | Company | Per-screen visibility / preview gates |

Engine state resolver: [`src/app/lib/unifiedLedgerEngineState.ts`](../../src/app/lib/unifiedLedgerEngineState.ts)  
Screen IDs: [`src/app/lib/unifiedLedgerScreenFlags.ts`](../../src/app/lib/unifiedLedgerScreenFlags.ts)

**Approved companies (production baseline):** DIN CHINA, DIN BRIDAL, DIN COUTURE — 5/5 main loaders ON each (per archive gate doc).

---

## Screens / loaders (web `src/`)

| Screen | Page component | Main loader resolver | Unified main service / legacy path |
|--------|----------------|---------------------|-----------------------------------|
| Ledger V2 | `LedgerStatementCenterV2Page` | `resolveLedgerV2MainLoaderSource` | `ledgerStatementCenterV2UnifiedMainService` vs `ledgerStatementCenterV2Service` (hybrid `getCustomerLedger` for customers) |
| Account Statement | `AccountLedgerReportPage` | `resolveAccountStatementMainLoaderSource` | Unified RPC vs legacy account/party loaders |
| Trial Balance | `TrialBalancePage` | `resolveTrialBalanceMainLoaderSource` | Unified TB RPC vs legacy TB |
| Party Ledger | `EffectivePartyLedgerPage` | `resolvePartyLedgerMainLoaderSource` | Unified party GL vs hybrid `getCustomerLedger` |
| Roznamcha | `RoznamchaReport` | `resolveRoznamchaMainLoaderSource` | Unified roznamcha mapper vs `roznamchaService` legacy |
| Cash Flow | `CashFlowReportPage` | `resolveCashFlowMainLoaderSource` | Unified cash flow main (Phase 3B-M live) |
| Balance Sheet | `BalanceSheetPage` | `resolveBalanceSheetMainLoaderSource` | Unified BS mapper vs legacy |
| Profit & Loss | `ProfitLossPage` | `resolveProfitLossMainLoaderSource` | Unified P&L mapper vs legacy |

**Preview / Admin Compare (shadow, not main table):**

- `*UnifiedPreviewPanel` components per screen
- `UnifiedLedgerTieOutPage`, `unified-ledger-compare` admin tabs
- Compare source flip: `unified_compare` ↔ `legacy_shadow` when main loader swaps

---

## Legacy paths (R8 retirement candidates — not removed yet)

| Path | Location | Classification |
|------|----------|----------------|
| `accountingService.getCustomerLedger` | `src/app/services/accountingService.ts` | Hybrid customer ledger (journal + synthetic sales/payments merge) |
| Ledger V2 customer branch | `ledgerStatementCenterV2Service.ts` → `getCustomerLedger` | Legacy main when loader OFF |
| Shadow compare panels | `*PreviewCompareSource` resolvers | Diagnostic — may remain until runbook says remove |
| `ledger_master` / `ledger_entries` | Supplier UI subledgers | Phase 8 map: `legacy_ui_subledger` |
| `worker_ledger_entries` | Studio fallback | Operational fallback |
| `sale_items` vs `sales_items` | Reports | Table fallback |
| Hybrid repair engine | `hybridRepairEngineService`, AR/AP repair panels | **Not** R8 Phase 1 — separate approval |
| Mobile parallel APIs | `erp-mobile-app/src/api/*` | Separate client; R8 web retirement must not break mobile contract without explicit mobile scope |

---

## Exports / print / WhatsApp

| Surface | Files | Loader follows |
|---------|-------|----------------|
| Ledger V2 CSV/PDF/WhatsApp | `LedgerStatementCenterV2Page`, `ledgerStatementCenterV2WhatsApp` | Active main loader (unified when flag ON) |
| Account Statement export | `accountStatementMainLoaderExportParity` tests | Main loader only |
| Trial Balance export | `trialBalanceMainLoaderExportParity` | Main loader only |
| Party / Roznamcha export | `partyLedgerMainLoaderExportParity`, `roznamchaMainLoaderExportParity` | Main loader only |
| Print settings | `resolveLedgerPrintOptions`, `PrintingSettingsPanel` | Presentation only |

R8 must preserve **export parity tests** when removing legacy branches.

---

## Mobile impact

- **erp-mobile-app** uses its own report API modules; not on unified web loader flags directly.
- Mobile Salesman QA: **PASS** (login) — Play Store **NOT RELEASED**.
- R8 scope in repo docs is **web unified ledger engine**; mobile retirement is out of scope unless explicitly paired in runbook.

---

## Rollback plan (no DB migration required for L1)

| Layer | Action |
|-------|--------|
| **L0 kill switch** | Set `unified_ledger_kill_switch` ON per company (or env override) → effective legacy |
| **L1 loader flags** | Turn OFF per-loader keys (`unified_ledger_loader_*`) via SQL rollback scripts per company |
| **L2 deploy** | Revert `erp-frontend` image to pre-R8 git tag; `deploy/vps-build-erp-only.sh` |
| **L3 git** | `git revert` R8 retirement commit(s) on `main` |
| **Monitoring** | Re-run `npm run monitor:three-company-unified-ledger` with credentials after rollback |
| **Data** | **Not required** if R8 is code/flag-only (no GL mutations) |

Post-R8 smoke (from preflight): Admin Compare pilot batch, three-company monitoring, Ledger V2, Party Ledger, Account Statement.

---

## Tests required before / after R8

| Command | Purpose |
|---------|---------|
| `npm run test:unified-ledger` | Loader resolvers, export parity, golden fixtures |
| `npm run test:unit` | Roznamcha, accounting services |
| `npm run build` | Production bundle |
| `npm run monitor:three-company-unified-ledger` | Live Admin Compare (needs per-company QA passwords) |

---

## Deploy required?

| Item | Required for R8? |
|------|------------------|
| Frontend deploy (`deploy/vps-build-erp-only.sh`) | **Yes** — after code removes legacy paths |
| DB migrations | **No** for flag-only rollback; **only if** runbook approves schema touch |
| VPS env change | Only if kill-switch env used |
| Play Store | **No** |

---

## Safety attestation (this inventory session)

| Item | Value |
|------|-------|
| R8 executed | no |
| Scripts executed | none |
| DB migrations | no |
| Production GL mutation | no |
| Passwords printed | no |
