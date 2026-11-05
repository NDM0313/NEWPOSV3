# IBRAHIM Class B backup/apply — production evidence — 2026-09-19

**Final verdict: `IBRAHIM_CLASS_B_PRODUCTION_REPAIR_VERIFIED_PASS`**

Earlier apply verdict (retained): `IBRAHIM_CLASS_B_REPAIR_APPLIED_PASS`

Owner approval phrase honored for apply:

`run IBRAHIM Class B backup/apply repair on production after migration verification`

Prerequisite migration evidence: [`PRODUCTION_JE_GUARD_MIGRATION_20260919.md`](./PRODUCTION_JE_GUARD_MIGRATION_20260919.md) (`PRODUCTION_JE_GUARD_MIGRATION_VERIFIED_PASS`).

**Not done:** ID LACE (NOT IMPLEMENTED); `03_rollback.sql` **NOT RUN**; branch merge not performed; no other parties (DHL / KIRAN / etc.).

Closure verification HEAD: `26b5bbb2ae89abefa2b00c11122f6e0c6ce5052e`  
Closure SQL (read-only): `deploy/staging-je-guard/ibrahim-class-b-closure-verify.sql`

---

## Preflight (live `postgres`) — at apply time

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

Repeat `02_apply` (at apply time): `ALREADY_APPLIED` — **not re-run during closure**.

---

## Post-apply verification (immediate)

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

## Read-only production closure (this phase)

### Current durable state

| Check | Result |
|------|--------|
| `run_id` exact | `ibrahim_v1_20260919143935` |
| manifest / pre_apply / post_apply counts | **2 / 2 / 2** |
| JE-0137 / JE-0138 on `AP-SUPZHD0026` | PASS |
| Debits 19000 / 99275; credits 0; JE ids match manifest | PASS |
| Headers JE-0137 (2025-12-03) / JE-0138 (2026-01-21); `reference_type=journal`; non-void | PASS |
| Approved IBRAHIM lines still on `210026` | **0** |

### Accounting invariants

| Metric | Value |
|--------|--------|
| Moved net | **118275** |
| AP before (apply NOTICE) | **-4740529** |
| AP after (live, matches NOTICE) | **-4622254** |
| Delta | **+118275** |
| JE-0137 balanced | Dr=Cr=19000 |
| JE-0138 balanced | Dr=Cr=99275 |
| Company TB (non-void, DIN) | Dr=Cr=**872277269.57**, diff **0** |

### Ledger / attribution

| Surface | Result |
|---------|--------|
| **Account Ledger** | Lines post to GL leaf `AP-SUPZHD0026` / Payable — IBRAHIM BNRS |
| **Party Ledger / attributed GL** | Same leaf linked to contact `SUP-ZHD-0026` / IBRAHIM BNRS (`08592090-…`) — path used by `getSupplierApGlJournalLedger` |
| Classification | **Both** |
| Duplicate repair lines | **No** — exactly 2 line ids on AP |
| These two lines still on `210026` | **No** |

### Collateral-mutation proof

| Check | Result |
|------|--------|
| New JE created by repair? | **No** — still one row each for JE-0137 / JE-0138 |
| New payment / PAY for these JEs? | **No** (0 payments referencing these JE ids) |
| Entry numbers unchanged | JE-0137 / JE-0138 |
| Only intended mutation | `journal_entry_lines.account_id` legacy→AP for the **two** lines (amounts + JE ids unchanged in pre/post) |
| Other suppliers in this package | **None** (`IBRAHIM_CLASS_B_ONLY`, 0 non-IBRAHIM manifest rows) |
| ID LACE | **NOT IMPLEMENTED** |
| Rollback | **NOT RUN** |

### Guard / health

| Check | Result |
|------|--------|
| `trg_guard_journal_entry_line_account` enabled | YES |
| IBRAHIM verified remap present | YES |
| Kong / Auth / ERP / public REST | HTTP 200; containers healthy |
| Recent REST `JOURNAL_ACCOUNT`/`FATAL`/`panic` (30m) | **0** |

---

## Package files used (unedited)

1. `reports/supplier-coa-dual-audit-20260919/repair-package/01_backup.sql`
2. `reports/supplier-coa-dual-audit-20260919/repair-package/02_apply.sql`

Rollback available if needed: `03_rollback.sql` (**not executed**).

**STOP** — no further party repairs in this phase.
