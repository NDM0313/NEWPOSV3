# DHL — courier role consolidation preview (NO production apply)

## CURRENT_STATE

| Field | Value |
|-------|--------|
| Contact | DHL `SUP-ZHD-0007` `6ce5bed0-…` |
| Type | `supplier` (**wrong** — owner: courier) |
| GL today | `AP-SUPZHD0007` under **2000** — **48** lines; net Dr **4,700,000** |
| Legacy | `210007` empty inactive; remap → AP-SUPZHD0007 |
| Courier 203x | **missing** for this contact |
| `couriers` table row | 0 |

## CANONICAL_ROLE

**Courier** — deposits/advances/charges under **2030** control via `get_or_create_courier_payable_account`.

## HISTORY_TO_MOVE

All 48 open lines on `AP-SUPZHD0007` → new DHL `203x` leaf (provisional class `MISFILED_SUPPLIER_AP_FOR_COURIER`). Economic meaning: predominantly deposits/advances (opening_balance + journal debits) and transfer settlements — **not** merchandise purchases (purchases count = 0).

## HISTORY_TO_PRESERVE

JE types unchanged; do not convert journal → payment.

## TARGET_ACCOUNTS

Create courier payable leaf under 2030 linked to DHL contact; optional `couriers` row for Settings UX.

## EXPECTED_BALANCE_BEFORE / AFTER

Before: AP-SUPZHD0007 net Dr 4,700,000.  
After: AP 0; 203x net Dr 4,700,000 (same).

## REPORTING_EFFECT

Exclude from Customers & Suppliers; show in courier / attributed GL. **Never merge with DHL PK.**

## ROLLBACK

`backup_coa_dhl_courier_v1` + per-line `repair_restore`.

## Package name

`DHL_COURIER_ROLE_CONSOLIDATION`
