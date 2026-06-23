# Single Core Ledger — Finance Sign-off Pack

**Status:** **Finance approval complete** — production metadata apply **not executed**  
**Branch:** `feature/single-core-ledger-phase-1-6-2-production-approval`  
**Fresh clone validated:** `ledger_stage_20260623_prodcheck` — Gate A 3/3 PASS, tie-out 9/9 PASS  
**Manifest SHA256:** `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd`  
**Master ready pack:** [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](SINGLE_CORE_LEDGER_PRODUCTION_READY.md)

---

## 1. Purpose

This pack documents **finance review and sign-off** for production metadata remediation.

Clone testing proved that filling missing metadata on a fresh production snapshot clears payment contact gaps and branch attribution risk without changing amounts or journal lines. **Production has not been changed yet.**

---

## 2. What will change

If applied (separate guarded step), production will receive **metadata-only** updates:

| Table | Column | What happens |
|-------|--------|--------------|
| `payments` | `contact_id` | Set to the customer linked to the related sale (74 rows) |
| `journal_entries` | `branch_id` | Set to the approved branch (2 auto + 6 manual = 8 rows) |

**Total: 82 rows.**

No money amounts change. No new documents are created.

---

## 3. What will NOT change

- **No** debit or credit amounts will change  
- **No** journal entry lines will be added, removed, or edited  
- **No** sales, purchases, or payments will be deleted  
- **No** voids, reversals, or reposting will occur  
- **No** GL account codes or balances will be recalculated by this step  
- **No** opening balance corrections  
- **No** AR/AP reclassification  

The unified ledger feature flag (`unified_ledger_engine`) **remains OFF**.

Phase 1.5 production migrations and Phase 2 screen wiring require **separate** written approval after this metadata step is validated.

---

## 4. Row summary

| Repair type | Table | Column | Rows | Risk | Approval |
|-------------|-------|--------|-----:|------|----------|
| payment_contact_backfill | payments | contact_id | 74 | Low | **Approved** |
| branch_auto | journal_entries | branch_id | 2 | Medium | **Approved** |
| branch_manual | journal_entries | branch_id | 6 | Medium | **Approved** |
| **Total** | | | **82** | | **82 Approved** |

**Artifacts:**

| File | Purpose |
|------|---------|
| [`reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv`](../reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv) | Signed finance CSV (82 × `APPROVED`) |
| [`reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json`](../reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json) | Canonical production manifest |

---

## 5. Approval checklist

- [x] Opened finance CSV and reviewed all **82** rows  
- [x] Confirmed each row is metadata-only (`contact_id` or `branch_id`)  
- [x] Marked each row `APPROVED` in `finance_approval` (0 rejected)  
- [x] Confirmed manifest SHA256: `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd`  
- [x] DB backup recorded (`PRODUCTION_BACKUP_ID`)  
- [x] Understood Phase 1.5 migrations and Phase 2 are **not** part of this approval  

---

## 6. Rollback note

Pre-apply backup: `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump`

If rollback is needed after apply: full restore from backup, or selective `contact_id` / `branch_id` NULL reverse from apply audit JSON.

---

## 7. Final sign-off area

```text
Approved by: Operations (bulk approve all 82 rows)
Date: 2026-06-23
Manifest SHA256: fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd
Backup ID: /root/NEWPOSV3/backups/supabase_db_20260623_192408.dump
Notes: Finance CSV signed; production apply still pending explicit operator go-ahead.
```

See also: [`SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md`](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md)
