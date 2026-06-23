# Single Core Ledger — Finance Sign-off Pack

**Status:** Pending finance approval — production apply **not executed**  
**Branch:** `feature/single-core-ledger-phase-1-6-2-production-approval`  
**Fresh clone validated:** `ledger_stage_20260623_prodcheck` — Gate A 3/3 PASS, tie-out 9/9 PASS  
**Manifest SHA256:** `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd`

---

## 1. Purpose

This pack is for **finance review and sign-off** before any production database change.

Clone testing has already proven that filling missing metadata on a fresh production snapshot clears payment contact gaps and branch attribution risk without changing amounts or journal lines. **Production has not been changed yet.**

Finance must review each proposed row and mark approval in the CSV before operations may proceed to backup and guarded production apply.

---

## 2. What will change

If approved and applied later (separate step), production will receive **metadata-only** updates:

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
| payment_contact_backfill | payments | contact_id | 74 | Low | Pending |
| branch_auto | journal_entries | branch_id | 2 | Medium | Pending |
| branch_manual | journal_entries | branch_id | 6 | Medium | Pending |
| **Total** | | | **82** | | **Pending** |

**Artifacts for review:**

| File | Purpose |
|------|---------|
| [`reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv`](../reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv) | Finance approval worksheet (fill `finance_approval` / `finance_note`) |
| [`reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json`](../reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json) | Canonical production manifest |
| [`reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.csv`](../reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.csv) | Full technical manifest export |

---

## 5. Approval checklist

Finance reviewer — complete before production apply is authorized:

- [ ] Opened finance CSV and reviewed all **82** rows  
- [ ] Confirmed each row is metadata-only (`contact_id` or `branch_id`)  
- [ ] Marked each row `APPROVED` or `REJECTED` in `finance_approval`  
- [ ] Added `finance_note` for any `REJECTED` row or branch manual assignment question  
- [ ] Confirmed manifest SHA256 matches: `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd`  
- [ ] Understood production apply requires **DB backup first** (`PRODUCTION_BACKUP_ID`)  
- [ ] Understood Phase 1.5 migrations and Phase 2 are **not** part of this approval  

**CSV instructions:** In [`finance-signoff-production-remediation-2026-06-23.csv`](../reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv):

- Write **`APPROVED`** for accepted rows  
- Write **`REJECTED`** for rejected rows  
- Add a note in **`finance_note`** for rejected rows or manual branch rows needing explanation  

Do **not** pre-fill approvals — each row must be explicitly reviewed.

---

## 6. Rollback note

Before production apply, operations must take a full database backup.

If rollback is needed after apply:

1. **Full restore** — restore `postgres` from the pre-apply backup dump, or  
2. **Selective reverse** — set `payments.contact_id` and `journal_entries.branch_id` back to `NULL` for affected IDs using the before/after audit file generated at apply time  

Rollback does not require voiding or reversing journal entries because no GL lines were changed.

---

## 7. Final sign-off area

Complete after CSV review:

```text
Approved by:
Date:
Manifest SHA256: fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd
Backup ID: /root/NEWPOSV3/backups/supabase_db_20260623_192408.dump (recorded 2026-06-23T19:24:08Z)
Notes:
```

Return the signed CSV to operations. Production apply remains **blocked** until backup ID is recorded and explicit production remediation approval is granted.

See also: [`SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md`](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md)
