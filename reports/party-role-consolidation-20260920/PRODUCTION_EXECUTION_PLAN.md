# Production execution plan — STOP before mutation

## Final verdict

# `ROLE_AWARE_PARTY_CONSOLIDATION_READY_FOR_OWNER_APPROVAL`

Meaning: forensic inventory + role mapping + reporting gaps + repair **previews** are complete and internally consistent.  
**Not** approved to mutate production. Staging apply still pending (`STAGING_RECONCILIATION.md`).

## Hard stops honored

- No production DML this phase
- IBRAHIM Class B backup / repair **untouched**
- DHL and DHL PK **not merged**
- No blind `210xxx → AP-SUP*` remaps (legacy already empty for these five)

## Recommended execution order (after staging PASS)

1. Master-data type flips (additive, reversible): KIRAN/SHAHMIM → `worker`; DHL/DHL PK → `courier`; ID LACE remains `supplier`
2. `DHL_PK_COURIER_ROLE_CONSOLIDATION` (1 line — lowest risk)
3. `ID_LACE_SUPPLIER_CONSOLIDATION` (assert-only / meta)
4. `DHL_COURIER_ROLE_CONSOLIDATION` (create 203x + move 48 lines)
5. `KIRAN_WORKER_ROLE_CONSOLIDATION` then `SHAHMIM_WORKER_ROLE_CONSOLIDATION` (create WA/WP + classified moves)
6. Reporting filter / unified courier party_type follow-up (separate UI/RPC PR)

## Owner approval phrases (suggested)

1. `approve party role consolidation design and run staging packages on fresh clone`
2. `apply DHL_PK courier consolidation on production after staging PASS`
3. (separate phrases per remaining package)

## Package inventory

| Package | Preview | Durable backup schema (proposed) |
|---------|---------|----------------------------------|
| ID_LACE_SUPPLIER_CONSOLIDATION | `ID_LACE_REPAIR_PREVIEW.md` | `backup_coa_id_lace_supplier_v1` (meta) |
| KIRAN_WORKER_ROLE_CONSOLIDATION | `KIRAN_WORKER_REPAIR_PREVIEW.md` | `backup_coa_kiran_worker_v1` |
| SHAHMIM_WORKER_ROLE_CONSOLIDATION | `SHAHMIM_WORKER_REPAIR_PREVIEW.md` | `backup_coa_shahmim_worker_v1` |
| DHL_COURIER_ROLE_CONSOLIDATION | `DHL_COURIER_REPAIR_PREVIEW.md` | `backup_coa_dhl_courier_v1` |
| DHL_PK_COURIER_ROLE_CONSOLIDATION | `DHL_PK_COURIER_REPAIR_PREVIEW.md` | `backup_coa_dhl_pk_courier_v1` |

Each package must include: meta, exact line manifest (UUIDs), pre/post snapshots, amount asserts, drift abort, idempotent repeat, `repair_restore` rollback — patterned on IBRAHIM Class B **without** sharing its schema.
