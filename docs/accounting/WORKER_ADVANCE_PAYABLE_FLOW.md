# Worker Advance vs Worker Payable (Studio)

## Accounts

| Code | Name | Type | Role |
|------|------|------|------|
| 1180 | Worker Advance | Asset | Control; **prefer `WA-*` leaf** per worker |
| 2010 | Worker Payable | Liability | Control; **prefer `WP-*` leaf** per worker |
| WA-* | Worker Advance — {name} | Asset | Per-worker leaf under 1180 (`_ensure_worker_advance_subaccount`) |
| WP-* | Worker Payable — {name} | Liability | Per-worker leaf under 2010 (`_ensure_worker_payable_subaccount`) |

## Payment posting (`worker_payment`, `reference_id` = worker UUID)

- **No open stage bill**: **Dr WA-* (or 1180 fallback) · Cr Cash/Bank**
- **Unpaid stage bill** (or Pay Now with unpaid `stageId`): **Dr WP-* (or 2010 fallback) · Cr Cash/Bank**

Canonical: `workerPaymentService.createWorkerPayment`, `addEntryV2Service.createWorkerPaymentEntry` (`workerAdvanceService.shouldDebitWorkerPayableForPayment`). Resolvers: `resolveWorkerAdvancePostingAccountId` / `resolveWorkerPayablePostingAccountId`.

## When the bill is generated (stage completed with cost)

1. **Dr 5000 · Cr WP-*** — `reference_type: studio_production_stage`, `reference_id: stageId`.
2. **Auto-apply advance**: **Dr WP-* · Cr WA-*** for `min(net advance, bill)`.  
   - `reference_type: worker_advance_settlement`, `reference_id: workerId`  
   - `action_fingerprint: worker_advance_apply:{stageId}:{billJournalEntryId}`

Implementation: `workerAdvanceService.applyWorkerAdvanceAgainstNewBill`.

## Net advance balance (GL)

Sum of **(debit − credit)** on the worker’s **WA leaf** (plus legacy **1180** control lines for the same worker refs) where:

- `reference_type IN ('worker_payment', 'worker_advance_settlement')`
- `reference_id = workerId`
- not void

## Lifecycle

| Step | Entry |
|------|--------|
| A Advance | Dr WA / Cr Cash |
| B Work bill | Dr WIP/expense / Cr WP |
| C Apply advance | Dr WP / Cr WA |
| D Final payment | Dr WP / Cr Cash |
| E Excess advance | Remains debit on WA |

Do **not** net WA and WP into one leaf.

## Courier note (203x)

Courier leaves under **2030** are often named “Payable” but routinely carry **debit deposits**. Reporting should show net position on the same 203x leaf (deposit Dr / charge Cr / settlement). See role-model implementation evidence.

## Files

| File | Role |
|------|------|
| `migrations/20260331_worker_advance_account.sql` | Seeds 1180 |
| `migrations/20260922120000_worker_courier_role_model_account_domain.sql` | WA ensure, WP gate, courier linked_contact_id, WA subtree GL |
| `src/app/services/workerAdvanceService.ts` | Balance + settlement via leaves |
| `src/app/services/partySubledgerAccountService.ts` | Ensure WA/WP |
| `src/app/lib/partyRoleAccountRouting.ts` | Explicit type→role (no name heuristics) |
| `src/app/lib/journalPartyPosting.ts` | JE assist; multi-leaf refuse unless workerIntent |

## Other entry points

- SQL helper `_resolve_worker_payment_debit_account` for payment debit routing.
- JE assist: when both WA and WP exist, require explicit leaf (or `workerIntent`).
