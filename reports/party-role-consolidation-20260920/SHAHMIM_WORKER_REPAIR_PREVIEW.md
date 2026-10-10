# SHAHMIM NAZ — worker role consolidation preview (NO production apply)

## CURRENT_STATE

| Field | Value |
|-------|--------|
| Contact | SHAHMIM NAZ `SUP-ZHD-0046` `f902a1f8-…` |
| Type | `supplier` (**wrong** — owner: worker) |
| GL today | `AP-SUPZHD0046` under **2000** — 86 lines; net Dr **5,000,000** |
| Legacy | `210046` inactive, **0** lines; remap → AP-SUPZHD0046 |
| WP/WA leaves | **none** |

## CANONICAL_ROLE

**Worker / artisan** — same rules as KIRAN (`1180` / `2010`).

## Provisional line classes

| Class | Lines | Dr | Cr |
|-------|------:|---:|---:|
| ADVANCE | 83 | 19,436,500 | 0 |
| WORK_PAYABLE | 3 | 0 | 14,436,500 |

## TARGET_ACCOUNTS

Create `WA-*` under 1180 and `WP-*` under 2010; move by provisional_class after owner review of CSV.

## HISTORY_TO_MOVE / PRESERVE

Same as KIRAN: account_id remaps only; no amount/date/reference_type mutation; no new PAY.

## EXPECTED_BALANCE_BEFORE / AFTER

Before: AP net Dr 5,000,000.  
After: AP drained; WA+WP components net to same economic position.

## REPORTING_EFFECT / ROLLBACK

Same worker pattern as KIRAN. Backup schema `backup_coa_shahmim_worker_v1`.

## Package name

`SHAHMIM_WORKER_ROLE_CONSOLIDATION`
