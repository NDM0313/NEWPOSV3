# ERP Commission — No Repeat Posting (Issue 3)

## Requirement
Once a sale’s commission has been generated/posted, that sale must not be included again in pending commission posting.

## Implementation

### 1. Selecting only pending sales
**File**: `src/app/services/commissionReportService.ts` — `postCommissionBatch()`

- Query for candidates uses:
  - `.or('commission_status.is.null,commission_status.eq.pending')`
  - `.gt('commission_amount', 0)`
- So only sales that are not already posted and have commission &gt; 0 are considered.

### 2. Update only still-pending rows
When marking sales as posted:

- Update: `commission_status = 'posted'`, `commission_batch_id = batch.id`
- Applied with:
  - `.in('id', saleIds)` (the ids we just queried as pending)
  - **and** `.or('commission_status.is.null,commission_status.eq.pending')`
- So even if two batches run in parallel or a sale was posted elsewhere, we do not overwrite `commission_status` for an already-posted sale.

### 3. Report and filters
- Report status filter “Pending” uses the same condition: `commission_status` is null or `'pending'`.
- “Posted” shows only `commission_status = 'posted'`.
- After posting, the report is refetched with status “All”, so posted sales move to “Posted” and no longer appear in “Pending” or in the next “Post Commission” run.

## Verification
- Post commission for a set of pending sales → they show as “Posted” and appear in “Posted” filter.
- Run “Post Commission” again for the same period/filters → no new batch for those sales; message or empty result if no other pending sales.
- Mixed set: some pending, some posted → only pending are included in the batch; posted are excluded by the query and not updated.

## Files changed
- `src/app/services/commissionReportService.ts`: in `postCommissionBatch`, added `.or('commission_status.is.null,commission_status.eq.pending')` to the **update** that sets `commission_status = 'posted'` and `commission_batch_id`, so already-posted sales are never updated.

## Summary
Repost prevention is enforced by: (1) only querying pending (or null) commission status for batch creation, and (2) only updating rows that are still pending when writing `commission_status = 'posted'` and `commission_batch_id`.
