# Limited repair package — IBRAHIM residual ONLY

**Date:** 2026-09-19  
**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Durable schema:** `backup_coa_limited_ibrahim_v1`  
**Status:** Scripts only — **do not apply** until owner approves + guard migration installed.

## Scope

| Party | Status |
|---|---|
| IBRAHIM BNRS — 2 JE lines (`JE-0137` / `JE-0138`) | **IMPLEMENTED** (Class B) |
| ID LACE | **NOT IMPLEMENTED** — needs a separate reviewed package before any script |
| DHL / KIRAN / SHAHMIM | Hold |
| DHL PK | Separate / blocked |

## Automatic remap scope vs historical repair

| Scope | What |
|---|---|
| **AUTOMATIC** | `journal_account_verified_remaps` seeded from Sept16 `merge_pairs` (inactive legacy → `AP-*`). Protects *new* posts to retired IDs. |
| **HISTORICAL repair** | This package moves **exactly two** existing IBRAHIM line IDs. Distinct from automatic seed. |
| **ID LACE** | **NOT IMPLEMENTED** here. |

## Prerequisites

1. Guard migration installed (tables + trigger + `repair_restore_journal_entry_line_account`).
2. Exact IBRAHIM remap row present in `journal_account_verified_remaps`.
3. Run as privileged DB role / `service_role` (rollback uses repair RPC; GUC alone is not enough and is ignored for privilege).
4. Schema name is fixed: `backup_coa_limited_ibrahim_v1` (01/02/03 must match).

## Order

1. `01_backup.sql` — durable manifest + pre_apply snapshot; aborts if count ≠ 2  
2. `02_apply.sql` — validates company/JE/status/amounts; already-applied = safe no-op; checks AP balance delta  
3. `03_rollback.sql` — compares to `post_apply_lines`; aborts on later edits; uses `repair_restore_journal_entry_line_account`

## Safety

- Missing backup → apply aborts.  
- **Existing backup → `01_backup` refuses overwrite** (no DROP of meta/manifest/pre/post).  
- Fresh backup is one transaction; validation failure rolls back with no durable evidence.  
- Concurrent drift → apply/rollback abort.  
- Post-apply edit → rollback aborts (no blind move).  
- Repeat apply/rollback → NOTICE no-op when already in target state.
