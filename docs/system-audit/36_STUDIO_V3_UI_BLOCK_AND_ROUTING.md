# 36. Studio V3 UI Block and Routing

**Date:** 2026-04-12  
**Relates to:** P1-5 backend block in `studioProductionV3Service.ts`  
**Status:** UI block applied; V3 is read-only until accounting JE layer is implemented

---

## Problem

P1-5 patched `studioProductionV3Service.completeStage()` to throw unconditionally:

```typescript
throw new Error('[Studio V3] Cannot complete stage: accounting journal entry layer not yet implemented. Use Studio V1 workflow.');
```

However, the UI entry points (`StudioProductionV3OrderDetail.tsx`, `StudioProductionV3Pipeline.tsx`) did not reflect this block. A user who opened a V3 order would:

1. See the **Complete** button on each stage row
2. Click it, enter a cost, click **Done**
3. Receive a `toast.error()` with the backend error message — confusing UX
4. Be unable to make progress with no forward path visible

---

## Changes Made

### `src/app/components/studio/StudioProductionV3OrderDetail.tsx`

1. **Added `AlertTriangle` import** from `lucide-react`

2. **Warning banner** inserted between the order header and the order detail grid:
   ```
   Studio V3 — Stage Completion Blocked
   Stage completion is disabled in V3 until the accounting journal entry
   layer is implemented. Use the Studio V1 workflow to record costs and
   generate invoices with GL entries.
   ```
   Styled: `border-amber-600/50 bg-amber-900/20` — amber/yellow alert.

3. **Complete button disabled**: The per-stage "Complete" button (which opened the inline cost input) now has:
   - `disabled` prop
   - `opacity-40 cursor-not-allowed` class
   - `title="Stage completion blocked: V3 accounting not yet implemented. Use Studio V1."`
   - Comment: `{/* P1-5: Complete is disabled — V3 accounting JE layer not yet implemented */}`

   The "Done" button (inside the cost input flow) is now unreachable since the cost input is no longer opened.

4. **Final Complete button**: Already effectively disabled — `canFinalComplete` requires `allStagesCompleted`, which can never be true since no stage can be completed. No change needed.

### `src/app/components/studio/StudioProductionV3Pipeline.tsx`

1. **Added `AlertTriangle` import** from `lucide-react`

2. **Warning banner** inserted between the page header and the orders list:
   ```
   Studio V3 — Read Only
   Stage completion is currently disabled in V3 pending accounting
   integration. To record production costs and generate invoices with
   GL entries, use Studio V1.
   ```
   Same amber styling as order detail.

---

## What Is NOT Blocked

The following V3 operations remain functional (they do not post JEs and are safe):

- **Viewing** V3 orders and stages
- **Assigning workers** to stages (no accounting impact)
- **Worker ledger entry recording** (separate from JE posting)
- **Creating V3 orders** from sales (no accounting impact at creation)
- **Invoice generation panel** (only accessible after all stages are completed — which is now unreachable, so this panel is naturally blocked)

---

## Feature Flag Interaction

The V3 UI is only accessible if `featureFlags?.studio_production_v3` is `true` for the company. Companies without this flag never see V3 routes. The banner applies only to companies where V3 is explicitly enabled.

If V3 should be hidden entirely from a company, setting `feature_flags.studio_production_v3 = false` in `company_settings` will remove the V3 routes from the sidebar.

---

## How to Unblock V3

The block is lifted by implementing the accounting JE layer inside `completeStage()`:

1. On stage completion, post a JE:
   - `Dr Studio Work-in-Progress (or direct Cost of Revenue)`
   - `Cr AP subledger / Workers Payable`
   - Amount = `actualCost`
2. Fingerprint: `studio_v3_stage_complete:{companyId}:{stageId}`
3. On final complete, post a revenue JE (similar to V1's `generateSalesInvoiceFromProductionV3`)
4. Remove the `throw` from `completeStage()`
5. Remove the UI `disabled` prop and warning banners
6. Run `verify_studio_v3_block_readiness.sql` to confirm no completions escaped the block

See `32_P1_STUDIO_V3_ACCOUNTING_HARD_BLOCK.md` for the full technical specification.

---

## Verification

```bash
# After UI deploy: open a V3 order in the browser
# Expected:
# 1. Amber warning banner visible at top of pipeline list
# 2. Amber warning banner visible at top of order detail
# 3. "Complete" button in each stage row is greyed out and non-clickable
# 4. No "Final Complete" button visible (canFinalComplete is always false)
```

```sql
-- Confirm no stage completions after block:
-- Run: scripts/system-audit/verify_studio_v3_block_readiness.sql CHECK 1
SELECT COUNT(*) FROM studio_production_stages_v3
WHERE status = 'completed' AND updated_at > '2026-04-12';
-- Expected: 0
```
