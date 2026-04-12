# 34. Studio Version Strategy — Final Decision

**Date:** 2026-04-12  
**Status:** LOCKED — V1 = production baseline; V2 = frozen; V3 = blocked until JE layer

---

## 1. Version Overview

| Version | Service | Tables | JE layer | Active callers | Decision |
|---------|---------|--------|----------|---------------|----------|
| V1 | `studioProductionService.ts` | `studio_production`, `studio_production_stages`, `worker_ledger_entries` | Yes (partial) | 14 component importers | **PRODUCTION BASELINE** |
| V2 | `studioProductionService.ts` (same file, V2 functions) | `studio_production` (shared with V1) or `studio_production_v2` | `studioCustomerInvoiceService.ts` (dead code — 0 importers) | None (dead code) | **FROZEN → SUNSET** |
| V3 | `studioProductionV3Service.ts` | `studio_production_orders_v3`, `studio_production_stages_v3`, `studio_production_cost_breakdown_v3` | None — HARD BLOCKED by P1-5 | Unknown (V3 UI exists) | **BLOCKED until JE layer** |

---

## 2. V1 — Production Baseline

**Status:** Keep. Do not remove. All new studio work must use V1 until V3 is accounting-safe.

### V1 Accounting Flow
1. Stage assigned → `worker_ledger_entries` INSERT (status: unpaid)
2. `ensureWorkerLedgerEntry()` tracks cost
3. Worker payment → `payments` row + GL JE via accounting service
4. FIFO allocation: `allocateUnpaidStageJobsAfterWorkerPayment()`
5. Stage marked paid → `worker_ledger_entries.status = 'paid'`

**Gap (known, tracked):** V1 does not post a JE at stage completion itself — only at payment. The cost accrual is tracked operationally (worker_ledger_entries), not in GL, until the worker is paid. This is acceptable for the current scale but should be fixed in a future phase.

### V1 Cleanup from P1-3
Five `workers.current_balance` write sites removed. Worker balance is now exclusively derived from `worker_ledger_entries` and GL. Display components may still read `workers.current_balance` as a cached hint.

---

## 3. V2 — Frozen / Sunset

**Status:** Freeze immediately. No new features. No new orders through V2. Sunset target: Q3 2026.

### Why Frozen
- `studioCustomerInvoiceService.ts` (the invoice bridge for V2) has **zero importers** — it is dead code
- V2 JE layer was never completed
- V2 data is in the same `studio_production` table as V1 — shared table, different status/type flag

### Sunset Steps
1. Confirm: zero `studio_production` rows with V2-specific type/status flags created after 2026-04-12
2. Mark all V2 functions as `@deprecated` in `studioProductionService.ts`
3. Remove V2 UI entry points (identify by searching for V2-specific flags in navigation)
4. Archive `studioCustomerInvoiceService.ts` (delete — it is already unreachable)
5. Migrate any V2 data to V1 format

---

## 4. V3 — Blocked Until JE Layer

**Status:** `completeStage()` throws (hard block by P1-5). Order creation, viewing, and stage assignment remain available.

### Why Blocked
V3 is a clean separate table family (`_v3` suffix). It has `completeStage()` which calls only `updateStage()` — no JE is posted. Revenue/cost recognised operationally with no GL counterpart.

### Unblock Checklist (do not remove block until all ✓)
- [ ] Import `accountingService` in `studioProductionV3Service.ts`
- [ ] Implement `resolveInventoryGlAccountId` + `resolveWorkerCostAccountId` for V3
- [ ] Post JE in `completeStage()`: Dr Production Cost / Cr Worker AP subledger
  - `reference_type: 'studio_production_v3'`
  - `action_fingerprint: 'studio_v3_stage:{companyId}:{stageId}'`
- [ ] Handle stage un-complete: post reversal JE
- [ ] Handle order-level completion JE (if applicable)
- [ ] `npm run build` — 0 errors
- [ ] SQL verify: every completed V3 stage has a matching active JE
- [ ] Remove `throw` block from `completeStage()`

### V3 Strengths (motivation to unblock)
- Clean schema (`_v3` tables, no shared state with V1)
- `studio_production_cost_breakdown_v3` provides per-stage cost breakdown
- `recalculateProductionCost()` recomputes aggregate from stages
- Separate `getDefaultStageNames()` — configurable workflow

---

## 5. Migration Path

### V1 → V3 (long term)

When V3 JE layer is complete:
1. Build V3 JE integration (see unblock checklist above)
2. Run V3 in parallel with V1 for 30 days (shadow mode)
3. Verify: V3 GL matches V1 GL for comparable orders
4. Migrate new orders to V3 exclusively
5. Freeze V1 (mark `@deprecated`)
6. Migrate historical V1 data to V3 (bulk migration script)
7. Drop V1 tables after confirmation period

### Timeline
| Milestone | Target |
|-----------|--------|
| V3 JE layer implementation | Q2 2026 |
| V3 shadow mode | Q3 2026 |
| V1 freeze | Q4 2026 |
| V1 → V3 full migration | Q1 2027 |
| V2 sunset | Q3 2026 |

---

## 6. Service Responsibility Map

| Concern | V1 | V3 |
|---------|----|----|
| Order CRUD | `studioProductionService` | `studioProductionV3Service` |
| Stage CRUD | `studioProductionService` | `studioProductionV3Service` |
| Worker assignment | `studioProductionService` | `studioProductionV3Service.assignWorker()` |
| Cost tracking | `worker_ledger_entries` | `studio_production_cost_breakdown_v3` |
| GL posting | Partial (payment only) | NONE (blocked) |
| Invoice line creation | `sales_items` (canonical, fixed P1-2) | Not implemented |
| Balance cache | Removed (P1-3) | N/A |
