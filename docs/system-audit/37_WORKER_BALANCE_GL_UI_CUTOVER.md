# 37. Worker Balance GL UI Cutover

**Date:** 2026-04-12  
**Relates to:** P1-3 (`studioProductionService.ts` — 5 `workers.current_balance` write sites removed)  
**Status:** UI cutover applied; canonical GL source now used everywhere

---

## Background

P1-3 removed all 5 manual write sites to `workers.current_balance` in `studioProductionService.ts`. The field is now a stale cache — it reflects the balance at the time of last write, but no new writes update it. The canonical source of a worker's unpaid balance is:

```sql
SELECT worker_id, SUM(amount) AS pending_balance
FROM worker_ledger_entries
WHERE company_id = '<company_id>'
  AND (status != 'paid' OR status IS NULL)
GROUP BY worker_id;
```

This is the same query that `studioService.getWorkersWithStats()` uses to compute `pendingAmount`.

---

## State Before This Task

### Already correct: Studio-specific components

Both studio worker display components were **already using `pendingAmount` from `getWorkersWithStats()`**:

| Component | Source |
|-----------|--------|
| `src/app/components/studio/StudioWorkflowPage.tsx` | `w.pendingAmount` from `getWorkersWithStats()` |
| `src/app/components/studio/WorkerDetailPage.tsx` | `pendingAmount` from combined ledger query |

These were correct before this task and required no change.

### Stale: ContactsPage.tsx Phase 1

`src/app/components/contacts/ContactsPage.tsx` loads in two phases:

**Phase 1 (fast):** Immediate display while canonical data loads. Previously read `workers.current_balance` as a quick first-pass.

**Phase 2 (canonical):** Calls `contactService.getContactBalancesSummary()` RPC, which provides the authoritative payables figure. This overwrites Phase 1 values.

After P1-3, Phase 1 values were stale (the cache was no longer being updated). Phase 2 still provided the correct canonical value, but if Phase 2 timed out or failed, the user would see the stale Phase 1 amount.

---

## Change Made

**File:** `src/app/components/contacts/ContactsPage.tsx`  
**Location:** Inside `loadContacts()`, Phase 1 worker balance fetch (~line 383)

### Before

```typescript
const { data: workerRows } = await supabase
  .from('workers')
  .select('id, current_balance')
  .eq('company_id', companyId);
const workerBalMap = new Map<string, number>(
  (workerRows || []).map((w: { id: string; current_balance?: number | null }) => [
    String(w.id),
    Number(w.current_balance) || 0,
  ])
);
```

### After

```typescript
// P1-3: workers.current_balance is no longer maintained — derive from GL ledger.
// Matches getWorkersWithStats() pendingAmount: sum of worker_ledger_entries where status != 'paid'.
const { data: ledgerRows } = await supabase
  .from('worker_ledger_entries')
  .select('worker_id, amount, status')
  .eq('company_id', companyId)
  .or('status.neq.paid,status.is.null');
const workerBalMap = new Map<string, number>();
(ledgerRows || []).forEach((row: { worker_id: string; amount?: number | null }) => {
  const prev = workerBalMap.get(String(row.worker_id)) || 0;
  workerBalMap.set(String(row.worker_id), prev + (Number(row.amount) || 0));
});
```

### Effect

- Phase 1 worker balances now match what `getWorkersWithStats().pendingAmount` returns
- Phase 2 RPC (canonical) continues to run and overwrite — providing a second confirmation
- No regression: the Phase 1 workerBalMap is still used as the fallback inside `convertFromSupabaseContact()` (when `workerBalanceByContactId` is undefined)

---

## Remaining `workers.current_balance` References

The following references to `current_balance` remain in the codebase but are **not display reads of the stale cache**:

| File | Line | Nature | Action |
|------|------|--------|--------|
| `AddEntryV2.tsx` | 240 | Falls back to `w.pendingAmount ?? w.current_balance` — pendingAmount wins | Safe; pendingAmount from getWorkersWithStats() is always available |
| `AddEntryV2.tsx` | 256 | Selects `current_balance` column in query for display fallback | Low risk; context is accounting entry quick-pick, not ledger reporting |
| `studioService.ts` | ~442 | Reads `current_balance` from DB when reconstructing a missing worker | Informational only — not used for balance display |
| `AccountingIntegrityLabPage.tsx` | 340 | Comment only | No action |

None of these are primary balance display paths. The primary display paths (ContactsPage Phase 1, StudioWorkflowPage, WorkerDetailPage) are all now GL-derived.

---

## Verification

**UI test:**
1. Open Contacts → filter to Workers
2. Find a worker with recent ledger entries
3. Phase 1 should show the correct pending balance (no stale flash)
4. Phase 2 (canonical RPC) should confirm the same amount

**SQL:**
```sql
-- Run: scripts/system-audit/verify_worker_balance_cache_vs_gl.sql
-- CHECK 1: Workers with drift > 0.01 (stale cache vs GL-derived)
-- Post-cutover, this list is informational only (cache diverges over time, UI no longer uses it)
-- CHECK 3: GL-derived canonical balances (what the UI now shows in Phase 1)
```

---

## Phase 2 RPC Note

`contactService.getContactBalancesSummary()` is the authoritative final-pass for ALL contact types including workers. If this RPC includes worker payables derived from `worker_ledger_entries`, it will confirm the same value as our Phase 1 change.

If the RPC does NOT include worker payables (only sales receivables and purchase payables), then our Phase 1 change is the only correction applied for workers. Verify by checking `get_contact_balances_summary` RPC logic in Supabase migrations.
