# 35. Post-Patch Verification and Repair Runbook

**Date:** 2026-04-12  
**Applies to:** Hardening patches from the previous session (P1-1 through P1-5, Phase 3)  
**Purpose:** Step-by-step operational guide for verifying the hardening patches and repairing historical data.

---

## How to Use This Runbook

Work through sections in order. Each section has:
- **What to check** — exact SQL or UI action
- **Good result** — what success looks like
- **Failure means** — what to investigate if it fails
- **Rollback / containment** — how to contain damage if a repair goes wrong

All SQL verification scripts are in `scripts/system-audit/`. All repair scripts are in `scripts/` and marked `repair_`.

---

## Section 1 — Purchase Return JE Verification

### Background
P1-1 patched `finalizePurchaseReturn()` to post a `purchase_return_settlement` JE. Any purchase return finalized **before** this patch has no JE. Any return finalized **after** should have one.

### 1.1 Verify New Returns Post JE Correctly

**UI test:**
1. Create a purchase with 2+ items, finalize it
2. Create a purchase return against it with 1 item
3. Finalize the return
4. Go to Accounting → Journal Entries
5. Filter by `reference_type = 'purchase_return'` or search for the return ID
6. **Good result:** One active JE exists with:
   - `Dr AP subledger (or 2000)` = return.total
   - `Cr Inventory (1200)` = return.total
   - `action_fingerprint = 'purchase_return_settlement:{companyId}:{returnId}'`
7. **Failure:** No JE found → code patch did not deploy; check import of `resolvePayablePostingAccountId` in `purchaseReturnService.ts`

**SQL test:**
```sql
-- Run: scripts/system-audit/verify_purchase_return_journal_integrity_post_patch.sql
-- Check 1: all final returns after patch date have a JE
SELECT COUNT(*) AS missing_je
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND pr.updated_at > '2026-04-12'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_id = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  );
-- Good result: 0
```

### 1.2 Idempotency Test

Finalize the same return twice (or call `finalizePurchaseReturn` twice with same returnId). **Good result:** Second call exits early (status already 'final'), no duplicate JE created. Confirm via:
```sql
SELECT COUNT(*) FROM journal_entries
WHERE reference_id = '<returnId>'
  AND action_fingerprint = 'purchase_return_settlement:<companyId>:<returnId>'
  AND (is_void IS NULL OR is_void = FALSE);
-- Good result: 1
```

### 1.3 Void Test

Finalize a return, then void it. **Good result:**
- A reversal JE exists with `reference_type = 'correction_reversal'`
- The original JE has `is_void = TRUE`
- No net GL impact from voided return

**Rollback note:** If void creates a bad reversal JE, manually set `is_void = TRUE` on the reversal and contact engineering. Do not drop JE lines.

---

## Section 2 — Historical Purchase Return Repair Procedure

### Background
All purchase returns finalized **before** the P1-1 patch have no settlement JE. Their supplier AP is overstated.

### 2.1 Assess Scale

Run this on VPS/staging:
```sql
SELECT company_id, COUNT(*) AS returns_without_je, SUM(total) AS unposted_amount
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_id = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
GROUP BY company_id;
```

**Good result:** 0 rows (no historical gap). If rows exist, proceed to 2.2.

### 2.2 Repair Procedure

Use `scripts/repair_purchase_return_missing_journal_entries.sql`:

1. **Run CHECK 1** — list all affected returns with amounts
2. **Run CHECK 2** — get AP account IDs per company (code 2000 or AP subledger)
3. **Run CHECK 3** — get Inventory account IDs per company (code 1200)
4. For each company: execute BLOCK A template with real values (one transaction per return)
5. **Run POST-REPAIR Verify 1** — count should be 0
6. **Run POST-REPAIR Verify 2** — discrepancy should be < 0.01 for all returns

**Critical:** Each BLOCK A execution is wrapped in BEGIN/COMMIT. If it fails mid-way:
- The transaction rolls back automatically
- Re-run the same block after fixing the error (the fingerprint prevents duplicate JE)

**Rollback if needed:** If a wrongly-posted JE is discovered:
```sql
UPDATE journal_entries SET is_void = TRUE WHERE action_fingerprint = 'purchase_return_settlement:<co>:<id>';
-- Then repost with correct amounts via the repair script
```

### 2.3 AP Impact Report

After repair, run this to confirm AP subledger tied-out:
```sql
-- AP balance from JE lines vs purchase_returns total
SELECT
  je.company_id,
  SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE -jel.credit END) AS net_ap_from_returns
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id AND (a.code LIKE 'AP-%' OR a.code = '2000')
WHERE je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.company_id;
```

---

## Section 3 — Sale Items Legacy-Write Verification

### Background
P1-2 eliminated all `sale_items` write paths. Verify no new writes are occurring.

### 3.1 SQL Check

```sql
-- Run: scripts/system-audit/verify_sale_items_no_new_writes.sql
SELECT COUNT(*) AS new_writes
FROM sale_items
WHERE created_at > '2026-04-12';
-- Good result: 0
-- Failure: New rows exist → identify their origin (check fallback path in studioProductionService.ts)
```

### 3.2 Functional Test

1. Create a new studio production sale (STD-* invoice)
2. Trigger the studio line creation via `createGeneratedProductAndStudioLine()`
3. **Good result:** New line in `sales_items` table, not `sale_items`
4. **Failure:** If `sales_items` insert fails for any column mismatch, the fallback now also writes to `sales_items` — check that the fallback payload only includes valid `sales_items` columns

### 3.3 Fallback Columns Check

`sales_items` must have all these columns:
- `sale_id`, `product_id`, `product_name`, `sku`, `quantity`, `unit_price`, `total`

If the fallback fails because a column is missing in `sales_items`, the solution is a DB migration adding the column — not reverting the fallback to `sale_items`.

---

## Section 4 — Worker Balance Drift Verification

### Background
P1-3 removed 5 `workers.current_balance` write sites. The cache field will now drift from `worker_ledger_entries` over time.

### 4.1 Measure Current Drift

```sql
-- Run: scripts/system-audit/verify_worker_balance_cache_vs_gl.sql
SELECT
  w.id,
  w.name,
  w.current_balance AS cached,
  COALESCE(SUM(wle.amount) FILTER (WHERE wle.status = 'unpaid'), 0) AS gl_derived,
  ABS(w.current_balance - COALESCE(SUM(wle.amount) FILTER (WHERE wle.status = 'unpaid'), 0)) AS drift
FROM workers w
LEFT JOIN worker_ledger_entries wle ON wle.worker_id = w.id
GROUP BY w.id, w.name, w.current_balance
HAVING ABS(w.current_balance - COALESCE(SUM(wle.amount) FILTER (WHERE wle.status = 'unpaid'), 0)) > 0.01
ORDER BY drift DESC;
```

**Good result:** All drifts < 0.01 (or near-zero)  
**Failure:** Large drift values mean the cached field was being maintained manually and now diverges. This is expected after P1-3. The fix is to **switch the UI to show `pendingAmount` from `getWorkersWithStats()`** (canonical) rather than `current_balance`.

### 4.2 UI Verification

1. Open Studio → Workers tab
2. Find a worker who has unpaid ledger entries
3. Check their displayed balance matches the SQL query above (GL-derived)
4. **If it shows cached value** and drift is > 0: the UI component has been updated in Task 4 to use `pendingAmount` — verify the component change deployed

---

## Section 5 — Studio V3 Block Verification

### Background
P1-5 made `completeStage()` throw. Task 3 adds a UI-level block. Verify both.

### 5.1 Backend Block

```typescript
// Test: call studioProductionV3Service.completeStage('any-id', 100)
// Expected: throws Error '[Studio V3] Cannot complete stage...'
```

Or in browser console (dev mode):
```javascript
// Should throw:
studioProductionV3Service.completeStage('test-id', 100).catch(e => console.log(e.message));
```

**Good result:** Error message contains "Studio V3" and "accounting journal entry layer"

### 5.2 UI Block Verification

```sql
-- Run: scripts/system-audit/verify_studio_v3_block_readiness.sql
-- Check no V3 stages were completed after the block was applied:
SELECT COUNT(*) AS v3_completions_after_block
FROM studio_production_stages_v3
WHERE status = 'completed'
  AND updated_at > '2026-04-12';
-- Good result: 0 (no completions after block was applied)
-- If > 0: check whether they were completed BEFORE the block (expected) or after (bug)
```

### 5.3 UI Banner Verification

1. Navigate to Studio → Production Pipeline (if V3 feature flag is on)
2. Open any V3 production order
3. **Good result:** Yellow/amber warning banner visible at top of order detail page explaining V3 is blocked
4. **Good result:** "Complete" button in stage row is disabled (not clickable)
5. **Good result:** Banner directs user to Studio V1

---

## Section 6 — Legacy Read Hard-Fail Verification

### Background
Phase 3 patched `failLegacyReadInDev()` to throw by default in non-production.

### 6.1 Dev Environment Test

1. In local dev (MODE=development), trigger a legacy read path
2. Example: call `assertNotLegacyTableForGlTruth('test', 'ledger_master')` in console
3. **Good result:** Throws `[accounting:legacy-blocked] test: Duplicate subledger ledger_master...`

### 6.2 Opt-Out Test

Set `VITE_ACCOUNTING_LEGACY_HARD_FAIL=false` in `.env.local`, restart dev server.
Repeat step 6.1.
**Good result:** `console.warn()` only, no throw.

### 6.3 Production Guard

Confirm MODE=production does NOT throw (warn only):
- Set `NODE_ENV=production` or check production build behavior
- **Good result:** No throw from `failLegacyReadInDev()` in production bundle

---

## Section 7 — Numbering Verification for Purchase Returns

### Background
P1-4 redirected `generateReturnNumber()` from `document_sequences` to `erp_document_sequences` using `document_type = 'purchase'`.

### 7.1 Sequence Seed Check

```sql
-- Run: scripts/system-audit/verify_purchase_return_numbering_post_patch.sql
SELECT document_type, current_value, prefix, branch_id
FROM erp_document_sequences
WHERE document_type IN ('purchase', 'purchase_return')
ORDER BY document_type, branch_id;
```

**Good result:** A `purchase` sequence exists. If NO sequence exists for `purchase`, the fallback `PRET-YYYYMMDD-xxxx` is used — this is acceptable but non-ideal. Consider seeding a `purchase_return` sequence.

**See doc 39** for the full numbering decision. Recommendation is a SEPARATE `purchase_return` sequence.

### 7.2 New Return Number Format

1. Create a draft purchase return
2. Check `return_no` field in DB
3. **Good result:** A formatted document number (e.g. `PUR-0001` or `PRET-0001`)
4. **Failure / Fallback:** `PRET-20260412-1234` (timestamp format) = no sequence seeded; create one

### 7.3 Legacy Sequence No Longer Used

```sql
SELECT MAX(updated_at) FROM document_sequences WHERE document_type = 'purchase_return';
-- Good result: no date after 2026-04-12 (no new increments)
```

---

## Section 8 — Reports / GL Reconciliation Spot Checks

### 8.1 Supplier Ledger Balance Tie-Out

For a known supplier with purchase returns:
```sql
-- Net AP from GL vs sum of purchases minus returns
SELECT
  c.name AS supplier,
  -- GL-derived AP balance (positive = we owe them)
  SUM(CASE
    WHEN jel.credit > 0 THEN jel.credit
    WHEN jel.debit > 0 THEN -jel.debit
  END) AS gl_balance
FROM contacts c
JOIN accounts a ON a.code = 'AP-' || LEFT(REPLACE(c.id::text, '-', ''), 8)
  AND a.company_id = c.company_id
JOIN journal_entry_lines jel ON jel.account_id = a.id
JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE c.company_id = '<company_id>'
  AND c.contact_type = 'supplier'
GROUP BY c.name
ORDER BY ABS(gl_balance) DESC;
```

**Good result:** Positive balances = we owe supplier; negative = they owe us (overpaid or credit).

### 8.2 Purchase Return JE Count Per Company

```sql
-- Run: scripts/system-audit/verify_gl_vs_operational_spotcheck.sql
SELECT
  pr.company_id,
  COUNT(pr.id) AS total_final_returns,
  COUNT(je.id) AS returns_with_je,
  COUNT(pr.id) - COUNT(je.id) AS gap
FROM purchase_returns pr
LEFT JOIN journal_entries je
  ON je.reference_id = pr.id
  AND je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE pr.status = 'final'
GROUP BY pr.company_id;
```

**Good result:** `gap = 0` for all companies after repair.

---

## Rollback Reference

| Patch | Rollback action |
|-------|----------------|
| P1-1 (JE posting) | Set JE `is_void = TRUE` for any bad JE; no code rollback needed (fingerprint prevents re-post) |
| P1-2 (sale_items) | Temporarily revert studioProductionService.ts fallback if `sales_items` columns missing |
| P1-3 (worker balance) | No DB rollback needed; cache field will drift; fix by re-running worker balance repair SQL |
| P1-4 (numbering) | If `erp_document_sequences` has no `purchase` sequence, seed one immediately |
| P1-5 (V3 block) | Block is intentional; cannot be removed without implementing V3 JE layer |
| Phase 3 (hard fail) | Add `VITE_ACCOUNTING_LEGACY_HARD_FAIL=false` to `.env.local` if dev breaks |
