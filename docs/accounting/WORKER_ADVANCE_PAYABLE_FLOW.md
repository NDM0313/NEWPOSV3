# Worker Advance vs Worker Payable (Studio)

## Accounts

| Code | Name            | Type      | Role |
|------|-----------------|-----------|------|
| 1180 | Worker Advance  | Asset     | Cash paid to worker **before** a stage bill exists |
| 2010 | Worker Payable  | Liability | Accrued when stage completes (**Dr 5000 Cr 2010**) |

## Payment posting (`worker_payment`, `reference_id` = worker UUID)

- **No open stage bill** for the worker (no unpaid `worker_ledger_entries` with `reference_type = studio_production_stage`):  
  **Dr 1180 Worker Advance · Cr Cash/Bank**
- **At least one unpaid stage bill** (or Pay Now with an unpaid bill for that `stageId`):  
  **Dr 2010 Worker Payable · Cr Cash/Bank**

Canonical implementation: `workerPaymentService.createWorkerPayment`, `addEntryV2Service.createWorkerPaymentEntry` (uses `workerAdvanceService.shouldDebitWorkerPayableForPayment`).

## When the bill is generated (stage completed with cost)

1. **Dr 5000 · Cr 2010** — `reference_type: studio_production_stage`, `reference_id: stageId` (`createProductionCostJournalEntry`).
2. **Auto-apply advance** (same worker, GL only): **Dr 2010 · Cr 1180** for `min(net advance balance, bill amount)`.  
   - `reference_type: worker_advance_settlement`  
   - `reference_id: workerId`  
   - `action_fingerprint: worker_advance_apply:{stageId}:{billJournalEntryId}` (idempotent)

Implementation: `workerAdvanceService.applyWorkerAdvanceAgainstNewBill` (called from `studioProductionService` after the cost JE).

## Net advance balance (GL)

Sum of **(debit − credit)** on account **1180** for journal entries where:

- `reference_type IN ('worker_payment', 'worker_advance_settlement')`
- `reference_id = workerId`
- not void

## Partial payments

- Pre-bill payments stack on **1180** until a bill posts; settlement consumes advance up to the bill amount; remainder stays on **1180** or on **2010** if the bill exceeds prepayments.
- Post-bill payments continue to debit **2010** until subledger marks jobs paid (unchanged).

## Reconciliation / reports

- **Trial balance / GL**: Inspect **1180** (prepaid) vs **2010** (owed) for the period; settlement entries explain moves between them.
- **Integrity / AR-AP lab**: Worker buckets that only looked at **2010** may need to include **1180** for full “prepay vs owed” picture.

## Files touched

| File | Change |
|------|--------|
| `migrations/20260331_worker_advance_account.sql` | Inserts **1180** per company |
| `src/app/services/defaultAccountsService.ts` | Ensures **1180** on init |
| `src/app/services/workerAdvanceService.ts` | Routing helper, balance, auto-settlement |
| `src/app/services/workerPaymentService.ts` | Debit **1180** vs **2010** |
| `src/app/services/addEntryV2Service.ts` | Same + optional `stageId` |
| `src/app/services/studioProductionService.ts` | Pass `workerId` into cost JE; run settlement after bill |

## Other entry points

- **SQL RPC** `rpc_confirm_stage_payment` (if used) may still post pay flows directly; align separately if that path is live.
- **Manual journals** that debit **2010** without using `createWorkerPayment` are unchanged.
