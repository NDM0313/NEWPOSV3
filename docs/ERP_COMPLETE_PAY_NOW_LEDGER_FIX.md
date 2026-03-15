# Complete + Pay Now Worker Ledger Fix

## Root cause (Complete + Pay Now flow)

1. **Job amount pre-filled as payment**  
   The Pay Now dialog opened with `amount = outstandingAmount` (e.g. 1900). If the user submitted without changing, or if the value was used elsewhere, the **job amount was recorded as a payment** → extra payment-style row for 1900 and PAYxxxx reference on the wrong row.

2. **No distinction between full and partial payment**  
   `createEntry` always called `recordAccountingPaymentToLedger` for Worker Payable. For **full** Pay Now (user pays the full job amount), the design was that the caller would call `markStageLedgerPaid` and the **job** row should be marked paid — but we were **also** inserting an extra accounting_payment row for the same amount, so the job amount appeared both as job and as payment.

3. **markStageLedgerPaid on partial payment**  
   For partial payment (e.g. 1100 of 1900), we still called `markStageLedgerPaid`, which marks the **entire** job row as paid. That’s wrong for partial; only the separate payment row (-1100) should apply.

## Files changed

| File | Change |
|------|--------|
| `src/app/context/AccountingContext.tsx` | `WorkerPaymentParams.stageAmount`; in `createEntry` (and retry path), when `stageId` + `stageAmount` and `amount >= stageAmount`, **skip** `recordAccountingPaymentToLedger` and dispatch `ledgerUpdated`; otherwise keep existing sync. |
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | Pay Now: initial amount **0** when `workerStageId` set; pass `stageAmount: effectiveOutstanding` to `recordWorkerPayment`; `onSuccess(paymentRef, amount)`; `[PAY NOW DEBUG]` log. |
| `src/app/components/studio/StudioSaleDetailNew.tsx` | `onSuccess` only calls `markStageLedgerPaid` when `amountPaid >= payChoiceAfterReceive.amount` (full payment). |

## Business rules (enforced)

- **No payment:** One worker earning/job row only (from receive path). No payment row.
- **Pay now – partial (e.g. 1100 of 1900):** One job row (+1900), one payment row (-1100). Do **not** mark the job row as paid. Net payable +800.
- **Pay now – full (e.g. 1900 of 1900):** One job row (+1900); **no** extra payment row; `markStageLedgerPaid` marks the job row as paid. No PAYxxxx on the job row for the payment event.

## Before / after (example: job 1900, pay 1100)

| | Before | After |
|---|--------|--------|
| Job row (studio_production_stage) | Missing or overwritten as payment-style | One row: +1900, reference_type = studio_production_stage |
| Payment row | 1900 and/or 1100 with PAY0069-style refs | One row: -1100, reference_type = accounting_payment, PAYxxxx |
| markStageLedgerPaid | Called for every Pay Now | Only when amountPaid >= job amount (full payment) |
| Dialog initial amount | 1900 (job amount) | 0 (user must enter amount; avoids recording job as payment) |

## SQL verification (company + optional worker)

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`. Replace `{worker_id}` or remove the worker filter to see all workers.

```sql
-- Latest worker ledger rows: job rows vs payment rows (expect one job + one payment per “Complete 1900 + Pay 1100”)
SELECT
  wle.id,
  wle.worker_id,
  w.name AS worker_name,
  wle.amount,
  wle.reference_type,
  wle.reference_id,
  wle.payment_reference,
  wle.status,
  wle.created_at
FROM worker_ledger_entries wle
LEFT JOIN workers w ON w.id = wle.worker_id AND w.company_id = wle.company_id
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  -- AND wle.worker_id = '{worker_id}'
ORDER BY wle.created_at DESC
LIMIT 100;
```

After fix, for one “Complete 1900 + Pay Now 1100”:

- One row with `reference_type = 'studio_production_stage'`, `amount = 1900` (job).
- One row with `reference_type = 'accounting_payment'`, `amount = -1100` (or negative per your convention), `payment_reference` like PAYxxxx.
- No row with amount 1900 and `reference_type = 'accounting_payment'`.

## Debug logs

- **UnifiedPaymentDialog:** `[PAY NOW DEBUG] Complete+PayNow flow` with jobAmount, paymentAmountEntered, stageId, workerId, referenceNo.
- **AccountingContext:** `[WORKER LEDGER DEBUG]` for worker ledger sync and “Pay Now full payment – skip worker_ledger insert” when skipping.

## WorkerDetailPage crash

Already fixed in a previous change: `getDepartmentIcon` default, color/status defaults, and safe render for `DeptIcon` so WorkerDetailPage does not crash on invalid/undefined component.
