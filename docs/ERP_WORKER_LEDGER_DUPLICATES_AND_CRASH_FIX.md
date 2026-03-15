# Worker Ledger Duplicates (Issue A) + WorkerDetailPage Crash (Issue B) – Fix Report

**Company:** `company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'`

---

## 1. Exact reason duplicates still appear

- **Dedupe is in place and correct:** Both `studioService.getWorkerLedgerEntries` and `ledgerDataAdapters.getWorkerLedgerData` dedupe by `(reference_type, reference_id)`. So **same journal (same reference_id) cannot appear twice** in either Worker Detail or Accounting Worker Ledger after dedupe.
- **Why you still see multiple payment rows (PAY0069, PAY0069, JE-8268, JE-0015, JE-8272):**
  - **If those are the same cash payment:** The app can create **more than one journal entry** for what the user thinks is one payment (e.g. double submit, or multiple “Pay Worker” with the same reference number). Each journal gets its own `reference_id` (journal UUID). So we get **multiple rows with different reference_ids** → dedupe does not merge them (they are different keys).
  - **If the DB still had duplicate rows for the same journal:** Running `npm run worker-ledger-dedupe` (script 06) removes them. After that, any remaining “duplicates” are **multiple distinct journal-backed rows** (multiple reference_ids), not the same journal twice.

---

## 2. DB duplicate vs UI duplicate

| Case | Explanation |
|------|-------------|
| **DB duplicate** | Two or more `worker_ledger_entries` rows with the **same** `(worker_id, reference_id)` for `reference_type = 'accounting_payment'`. Idempotency in `recordAccountingPaymentToLedger` prevents new ones; script 06 removes existing ones. Display dedupe hides any that remain. |
| **UI duplicate** | Same row rendered twice. **Not the current cause:** both Worker Detail and Accounting Ledger use dedupe by `(reference_type, reference_id)` before render. |
| **Multiple journals for one logical payment** | Several journal entries (e.g. JE-8268, JE-0015, JE-8272) each have one worker_ledger row. So you see several payment lines (PAY0069, JE-8268, …). That’s **multiple DB rows with different reference_ids** (one per journal), not a UI bug. Fix: avoid creating multiple journal entries for one payment (single submit, no double-click, optional idempotency key at journal level). |

**Answer:** Duplicates can be **(1) DB duplicates** (same reference_id) – addressed by idempotency + script 06 + display dedupe – and/or **(2) multiple journal entries** (different reference_ids) – addressed by preventing duplicate journal creation, not by ledger dedupe.

---

## 3. Exact component import/export bug (Issue B)

- **Failing element:** `DeptIcon` rendered as `<DeptIcon size={14} className="mr-1" />` inside a `Badge` (WorkerDetailPage ~line 359).
- **Cause:** `getDepartmentIcon(worker.department)` has no `default` and only handles `'Dyeing' | 'Stitching' | 'Handwork'`. For any other value (e.g. from API or `mapStageTypeToDept`), it returns **undefined** → React error “Element type is invalid... got undefined”.
- **Fix:**  
  - Added `default: return Package` in `getDepartmentIcon`.  
  - Rendered with guard: `{DeptIcon ? <DeptIcon size={14} className="mr-1" /> : <Package size={14} className="mr-1" />}`.  
  - Added defaults in `getDepartmentColor` and `getJobStatusColor` so no switch falls through to undefined.

---

## 4. Provider order / useAccounting (Issue B)

- **Provider order in App.tsx:**  
  `AccountingProvider` (line 400) wraps `SettingsProvider` → `SalesProvider` → `PurchaseProvider` → **RentalProvider** → … → `AppContent`. So **RentalProvider is inside AccountingProvider**.
- **RentalContext** calls `useAccounting()` at top level (line 163). That runs under AccountingProvider, so the hook is valid.
- **Conclusion:** There is **no provider-order bug**. “useAccounting must be used within AccountingProvider” would only appear if a component that uses `useAccounting` were rendered outside this tree (e.g. a portal or another route tree). The crash you saw was from the **invalid element (undefined DeptIcon)**, not from provider order.

---

## 5. Files changed

| File | Change |
|------|--------|
| **WorkerDetailPage.tsx** | `getDepartmentIcon`: add `default: return Package`. `getDepartmentColor` / `getJobStatusColor`: add `default` so no undefined. Guard render: `DeptIcon ? <DeptIcon ... /> : <Package ... />` for the header badge. |
| **08_inspect_worker_ledger_company.sql** (new) | Inspection queries: group payment rows by worker/reference_type/reference_id/amount/date; list duplicate groups; list latest 50 payment rows. |

No change to provider order or to RentalContext. No change to `recordAccountingPaymentToLedger` idempotency or to getWorkerLedgerEntries / getWorkerLedgerData dedupe (already correct).

---

## 6. SQL used for DB verification

- **08_inspect_worker_ledger_company.sql** (new, in `scripts/worker_ledger_repair/`):
  - **Query 1:** Group payment rows by worker_id, reference_type, reference_id, amount, created_at::date, payment_reference; show row_count and ledger ids per group.
  - **Query 2:** Duplicate groups only – same (worker_id, reference_id), count > 1 (true DB duplicates).
  - **Query 3:** Latest 50 accounting_payment rows with worker name, amount, reference_id, payment_reference, created_at.

Run in Supabase SQL Editor. Use query 2 to see if any same-reference_id duplicates remain; if yes, run **06_duplicate_cleanup_company.sql** (or `npm run worker-ledger-dedupe`).

---

## 7. Final verification checklist

- [ ] **Issue B – Crash:** Open Worker Detail for a worker whose department is not Dyeing/Stitching/Handwork (or is missing). Page should render without “Element type is invalid” and without “useAccounting must be used within AccountingProvider”.
- [ ] **Issue B – Providers:** Confirm in App.tsx that AccountingProvider wraps RentalProvider (and thus all useAccounting callers).
- [ ] **Issue A – DB duplicates:** Run **08** query 2 for the company. If 0 rows → no same-reference_id duplicates. If any rows → run **06** (or `npm run worker-ledger-dedupe`), then **07**; query 2 should then return 0.
- [ ] **Issue A – Multiple payment lines:** If you still see several payment rows (e.g. PAY0069, JE-8268, JE-0015), run **08** query 3 and check reference_id: if each row has a **different** reference_id, those are multiple journal entries; prevent duplicate journal creation (e.g. one submit per payment, idempotency key) instead of relying on ledger dedupe.
- [ ] **Idempotency:** Create one worker payment; in console confirm “worker_ledger_entries insert result” once. Trigger sync again (e.g. retry); confirm “skip duplicate (row exists)” and no second insert.
- [ ] **Display dedupe:** Worker Detail and Accounting → Ledger → Worker both use deduped data; same (reference_type, reference_id) should never appear twice in the list.

---

## Summary

- **Duplicate cause:** Either **(1)** real DB duplicates (same reference_id) – handled by idempotency, cleanup script, and display dedupe – or **(2)** multiple journal entries (different reference_ids) – need to avoid creating multiple journals per payment.
- **Crash cause:** `getDepartmentIcon` could return undefined for some department values; Badge then rendered undefined as a component. Fixed by default return and a safe render guard.
- **Provider order:** Correct; AccountingProvider wraps RentalProvider. No change made there.
