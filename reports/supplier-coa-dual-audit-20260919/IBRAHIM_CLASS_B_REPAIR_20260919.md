# IBRAHIM Class B backup/apply — production evidence — 2026-09-19

**Verdict: `IBRAHIM_CLASS_B_REPAIR_APPLIED_PASS`**

Owner approval phrase honored:

`run IBRAHIM Class B backup/apply repair on production after migration verification`

Prerequisite migration evidence: [`PRODUCTION_JE_GUARD_MIGRATION_20260919.md`](./PRODUCTION_JE_GUARD_MIGRATION_20260919.md) (`PRODUCTION_JE_GUARD_MIGRATION_VERIFIED_PASS`).

**Not done:** ID LACE (NOT IMPLEMENTED); `03_rollback.sql` not run; branch merge not performed; no other parties (DHL / KIRAN / etc.).

---

## Preflight (live `postgres`)

| Check | Result |
|------|--------|
| Guard remaps + `repair_restore_…` | Present |
| IBRAHIM verified remap `210026 → AP-SUPZHD0026` | Present |
| `backup_coa_limited_ibrahim_v1` before run | ABSENT |
| JE-0137 / JE-0138 lines on legacy `210026` | YES — Dr 19000 / 99275, non-void |

---

## 01_backup.sql

| Item | Value |
|------|--------|
| Target | `postgres` via `ssh dincouture-vps` → `psql -v ON_ERROR_STOP=1` |
| Result | `BACKUP_OK` … `COMMIT` |
| Schema | `backup_coa_limited_ibrahim_v1` |
| `run_id` | `ibrahim_v1_20260919143935` |
| Scope | `IBRAHIM_CLASS_B_ONLY` |
| `id_lace_status` | `NOT_IMPLEMENTED` |
| Manifest lines | **2** |

---

## 02_apply.sql

| Item | Value |
|------|--------|
| Result | `APPLY_OK` … `COMMIT` |
| Moved | **2** IBRAHIM lines |
| NOTICE | `legacy_net_before_move_context=118275.00 ap_before=-4740529.00 ap_after=-4622254.00` |
| AP delta | `118275.00` (= 19000 + 99275) |

Repeat `02_apply`: `ALREADY_APPLIED: IBRAHIM 2 lines already on AP — safe no-op stop`.

---

## Post-apply verification

| Line | Entry | Account | Debit |
|------|-------|---------|-------|
| `677c74de-…` | JE-0137 | `AP-SUPZHD0026` (`2c56a1d1-…`) | 19000.00 |
| `343c2586-…` | JE-0138 | `AP-SUPZHD0026` (`2c56a1d1-…`) | 99275.00 |

| Check | Result |
|------|--------|
| Still on legacy `210026` | **0** |
| `post_apply_lines` on AP | **2** |
| ID LACE | **NOT_IMPLEMENTED** |

---

## Package files used (unedited)

1. `reports/supplier-coa-dual-audit-20260919/repair-package/01_backup.sql`
2. `reports/supplier-coa-dual-audit-20260919/repair-package/02_apply.sql`

Rollback available if needed: `03_rollback.sql` (not executed).
