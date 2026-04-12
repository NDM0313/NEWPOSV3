# 30. P1-3: Workers Balance Cache Cleanup

**Date:** 2026-04-12  
**Status:** PATCHED — 5 write sites removed  
**Priority:** P1  
**Bug class:** Manual cache write diverges from GL truth

---

## 1. Problem Statement

`workers.current_balance` is a denormalized cache field on the `workers` table. It was intended to track the total amount owed to each worker (accumulated unpaid studio stage costs). However:

1. The canonical source of this balance is `worker_ledger_entries` table + GL journal lines in `journal_entry_lines`
2. `studioProductionService.ts` maintained this cache via direct `workers.update({ current_balance: ... })` calls
3. These manual updates could drift from the GL truth (race conditions, failed updates, partial rollbacks)
4. The architecture decision is: **balance is derived from GL — cache fields must not be manually written by application code**

---

## 2. Write Sites Removed (5 total)

| File | Context | Removed code |
|------|---------|-------------|
| `studioProductionService.ts` ~1404–1406 | `ensureWorkerLedgerEntry()` — add cost | `current_balance + cost` write |
| `studioProductionService.ts` ~1658–1660 | Stage reassignment loop — subtract cost | `bal - cost` write |
| `studioProductionService.ts` ~1753–1755 | `updateStageWithCost()` — add diff | `bal + diff` write |
| `studioProductionService.ts` ~1793–1796 | `markWorkerLedgerEntryPaid()` — subtract amount | `currentBalance - amount` write |
| `studioProductionService.ts` ~1899–1902 | `addWorkerLedgerEntryForPayment()` — subtract amount | `currentBalance - amount` write |

Each removed block replaced with:
```typescript
// P1-3: balance is derived from GL — do not write workers.current_balance
```

---

## 3. What Was Removed vs What Remains

### Removed
- All reads of `workers.current_balance` followed by a write
- All `supabase.from('workers').update({ current_balance: ... })` calls in `studioProductionService.ts`

### Remains (intentionally)
- `worker_ledger_entries` table writes — this is the canonical worker transaction log
- `supabase.from('workers').select('current_balance')` reads for display purposes — these are cache reads for UI, acceptable
- Any trigger-maintained updates to `workers.current_balance` — trigger can continue as cache; application layer does not write

---

## 4. Canonical Worker Balance Query

```sql
-- Correct worker balance: sum of unpaid ledger entries
SELECT
  w.id,
  w.name,
  COALESCE(SUM(wle.amount) FILTER (WHERE wle.status = 'unpaid'), 0) AS owed_balance,
  w.current_balance AS cached_balance,
  ABS(COALESCE(SUM(wle.amount) FILTER (WHERE wle.status = 'unpaid'), 0) - w.current_balance) AS drift
FROM workers w
LEFT JOIN worker_ledger_entries wle ON wle.worker_id = w.id
GROUP BY w.id, w.name, w.current_balance
ORDER BY drift DESC;
```

---

## 5. Note on `contacts.current_balance`

The original plan item P1-3 referenced `contacts.current_balance`. Investigation of the actual code found that the write sites are on `workers.current_balance`, not `contacts.current_balance`. Contacts balance is managed differently:
- `contacts.current_balance` is maintained by a Postgres trigger (not application code)
- No application writes to `contacts.current_balance` were found in `studioProductionService.ts`

Both fields are cache-only and must not be used as GL truth. The policy is the same: read for display; use GL subledger for accounting decisions.
