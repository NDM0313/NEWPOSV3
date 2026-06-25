# Single Core Ledger Phase 2.1 — Flags + Safety Banners Report

**Status:** `PHASE 2.1 COMPLETE` — flags + banners infrastructure shipped; engine still OFF  
**Branch:** `feature/single-core-ledger-phase-2-1-flags-banners`  
**Base:** `feature/single-core-ledger-phase-2-rollout-plan` @ `61992dc5`  
**Date:** 2026-06-14  

---

## Summary

Phase 2.1 adds centralized unified-ledger flag resolution, deploy-time and DB-read kill switch, reusable safety banners, and admin tie-out integration only. **No production statement screen changed data sources.** `unified_ledger_engine` remains **OFF** by default; no `feature_flags` writes in app code.

---

## What shipped

| Area | Files |
|------|-------|
| Central resolver | `src/app/lib/unifiedLedgerEngineState.ts` |
| Flag key constants | `src/app/lib/unifiedLedgerFlagKeys.ts` |
| Per-screen scaffold | `src/app/lib/unifiedLedgerScreenFlags.ts` |
| Basis UI bridge | `src/app/lib/unifiedLedgerBasisUi.ts` |
| Engine banner | `src/app/components/accounting/UnifiedLedgerEngineBanner.tsx` |
| Preview badge | `src/app/components/accounting/UnifiedLedgerPreviewBadge.tsx` |
| React hook | `src/app/hooks/useUnifiedLedgerEngineState.ts` |
| Extended flags | `src/app/lib/unifiedLedgerFeatureFlag.ts`, `src/app/services/featureFlagsService.ts` |
| Kill guard | `src/app/services/unifiedLedgerService.ts` → `shouldUseUnifiedRpc` |
| Admin surface only | `src/app/components/admin/UnifiedLedgerTieOutPage.tsx` |

---

## Flag resolution order

1. **Env kill** — `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true` → mode `killed`
2. **DB kill** — `unified_ledger_kill_switch` row enabled → mode `killed`
3. **localStorage override** — dev override wins over DB for company engine
4. **Per-screen flag** — screen gate (requires company engine ON for `unified` mode)
5. **Company engine** — `unified_ledger_engine` row enabled
6. **Default** — mode `legacy`, engine OFF

### Engine modes

| Mode | Meaning |
|------|---------|
| `legacy` | Production default — legacy data paths |
| `disabled` | Unified engine OFF (company on, no screen context) |
| `preview` | Admin tie-out / shadow compare only |
| `unified` | Company engine ON + per-screen flag ON |
| `killed` | Kill switch active — legacy only |

### Flag keys (read only in 2.1)

| Key | Default |
|-----|---------|
| `unified_ledger_engine` | OFF |
| `unified_ledger_pilot` | OFF |
| `unified_ledger_kill_switch` | OFF |
| `unified_ledger_screen_ledger_v2` | OFF |
| `unified_ledger_screen_account_statement` | OFF |
| `unified_ledger_screen_trial_balance` | OFF |
| `unified_ledger_screen_roznamcha` | OFF |
| `unified_ledger_screen_party_ledger` | OFF |

---

## Kill switch behavior

| Mechanism | Variable / key | Effect |
|-----------|----------------|--------|
| Build env | `VITE_UNIFIED_LEDGER_ENGINE_KILLED` | Instant kill on redeploy |
| DB | `unified_ledger_kill_switch` | Ops INSERT later; code reads only |

`shouldUseUnifiedRpc`: when kill active, `useRpc` is **false** unless `shadowForce: true` (admin tie-out still works).

---

## Banner integration (2.1 only)

| Surface | Mounted | Data source changed |
|---------|---------|---------------------|
| `UnifiedLedgerTieOutPage` | Yes | No |
| Ledger V2 | No | No |
| Account Statement | No | No |
| Trial Balance / Roznamcha / Party Ledger | No | No |

---

## No-data-mutation guarantee

- No `feature_flags` INSERT/UPDATE in new code paths
- No SQL migrations
- No imports of unified RPCs from statement/report pages (verified)
- `UNIFIED_LEDGER_ENGINE_DEFAULT` remains `false`
- Tests: `npm run test:unified-ledger` — **41/41 PASS**

---

## Tests added

- `src/app/lib/unifiedLedgerEngineState.test.ts` — resolution order, kill switch, screen gates
- `src/app/lib/unifiedLedgerBasisUi.test.ts` — `audit_full` ↔ `audit_full_history` mapping
- Extended `src/app/lib/unifiedLedgerFeatureFlag.test.ts`

---

## Rollback

Revert PR 2.1 — instant code revert, no DB restore required. Engine was never ON.

---

## Next (PR 2.2+)

- Extend admin compare surfaces
- Wire Ledger V2 / Account Statement with per-screen flags (2.3+)
- Do **not** enable `unified_ledger_engine` without ops approval
