# DHL PK — courier role consolidation preview (NO production apply)

**Critical:** `DHL ≠ DHL PK` — separate contact, accounts, packages, views.

## CURRENT_STATE

| Field | Value |
|-------|--------|
| Contact | DHL PK `SUP-ZHD-0162` `4505905b-…` |
| Type | `supplier` (**wrong** — owner: courier) |
| Canonical courier | `2030162` under **2030** — **14** lines; net Dr **6,550,000** |
| Misfiled AP | `AP-SUPZHD0162` — **1** payment line Dr **500,000** |
| Purchases | 0 |

## CANONICAL_ROLE

**Courier** — keep `2030162` as primary.

## HISTORY_TO_MOVE

Only the **1** open line on `AP-SUPZHD0162` → `2030162` (class `MISFILED_SUPPLIER_AP_FOR_COURIER`).

## HISTORY_TO_PRESERVE

All 14 lines already on `2030162` (deposits/journals).

## EXPECTED_BALANCE_BEFORE

- 2030162: Dr 6,550,000  
- AP-SUPZHD0162: Dr 500,000  
- Combined attributed (if unioned wrongly): 7,050,000

## EXPECTED_BALANCE_AFTER

- 2030162: Dr **7,050,000**  
- AP-SUPZHD0162: **0**  
- No double-count in party view

## REPORTING_EFFECT

Separate courier party from DHL. Contact type → `courier`. Deactivate or leave empty AP leaf after drain.

## ROLLBACK

`backup_coa_dhl_pk_courier_v1` — single-line restore.

## Package name

`DHL_PK_COURIER_ROLE_CONSOLIDATION`
