# Payment path matrix — worker / courier

## Worker

| Path | Front | Service | RPC / DB | Debit account after cutover |
|------|-------|---------|----------|------------------------------|
| Web worker payment | Worker payment UI | `workerPaymentService.createWorkerPayment` | `record_payment_with_accounting` (`worker_payment`) | **WA-\* / WP-\*** via `_resolve_worker_payment_debit_account` (fixed `20260922130000`) |
| Studio Pay Now | Studio | same RPC + `p_worker_stage_id` | same | WP leaf when unpaid stage; else WA leaf |
| Add Entry worker | Add Entry V2 | `addEntryV2Service` → same RPC | same | same |
| Mobile worker pay | erp-mobile | mirrors `record_payment_with_accounting` | same | same |
| Studio stage bill | Studio finalize | `studioProductionService` / mobile `studioFinalizeAfterInvoice` | JE insert + `_ensure_worker_payable_subaccount` | **WP-\*** (already leaf-aware in TS) |
| Advance apply | `workerAdvanceService` | JE `worker_advance_settlement` | TS `resolveWorkerAdvance/PayablePostingAccountId` | WA/WP leaves |
| Direct resolver | — | — | `_resolve_worker_payment_debit_account` | WA/WP |

### Blocker closed

Pre-fix: unpaid-stage false → debit **bare 1180**.  
Classified **`PAYMENT_ROUTING_BLOCKER`**.  
Fixed + proven on staging: KIRAN `record_payment` Dr **`WA-SUPZHD0036`** 77 (`RPC_WORKER_PAYMENT_LEAF_OK`).

## Courier

| Path | Front | Service | RPC | Credit/Debit leaf |
|------|-------|---------|-----|-------------------|
| PayCourierModal / courier payment | UI | `courierPaymentService` | `record_payment_with_accounting` (`courier_payment`) → `get_or_create_courier_payable_account` | **203x** |
| Shipment accounting | — | `shipmentAccountingService` | `get_or_create_courier_payable_account` | 203x |
| Add Entry courier | Add Entry V2 | party assist | JE to 203x | 203x |

## Ordinary supplier

`createSupplierPayment` / purchase path → `_ensure_ap_subaccount_for_contact` → **AP-\*** only. WA/WP/courier create fail-loud for non-matching roles.
