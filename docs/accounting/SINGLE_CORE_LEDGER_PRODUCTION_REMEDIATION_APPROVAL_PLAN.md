# Single Core Ledger — Production Remediation Approval Plan

**Status:** PROPOSAL ONLY — **no production execution**  
**Prerequisite:** Gate A PASS on VPS clone (`ledger_stage_20260623` or fresh re-clone)  
**Branch:** `feature/single-core-ledger-phase-1-6-remediation`

---

## Purpose

This document defines the **approval checklist and rollback plan** for applying Phase 1.6 metadata repairs to production **after** clone validation. It does **not** authorize production changes by itself.

---

## 1. Exact rows (from clone dry-run manifest)

Production apply must use a **fresh dry-run** against current production data (read-only) or a new `ledger_stage_YYYYMMDD` dump. The approved row set is the `safe_apply: true` subset from:

- `reports/single-core-ledger/remediation-dry-run-<timestamp>.json`
- SHA256 in `manifest.sha256` — apply scripts reject stale files

**Expected counts (from Phase 1.5 clone baseline):**

| Repair | Expected safe_apply rows |
|--------|--------------------------|
| Payment contact backfill | ~74 (70 DIN CHINA + 4 DIN BRIDAL) |
| Branch attribution | 0–4 auto-safe; 2 transfer JEs manual review |

Payment IDs and JE IDs are listed in the clone dry-run JSON/CSV — export and attach to approval ticket.

---

## 2. CLI plan (future — not implemented until Gate A)

1. **Backup production** (mandatory):
   ```bash
   ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7"
   ```
2. **Fresh clone** from current prod: `ledger_stage_YYYYMMDD`
3. **Re-run dry-run** on fresh clone; compare SHA256 row set to this approval doc
4. **Written sign-off** from finance owner on safe_apply manifest
5. **Production apply** (future scripts): reuse clone apply with additional gates:
   - `PRODUCTION_REMEDIATION_APPROVED=1`
   - Backup timestamp recorded in env
   - Explicit `--dry-run-file` + `--expected-safe-count`

**Not in Phase 1.6:** `apply-*-production.mjs` scripts are deferred until Gate A on clone.

---

## 3. Backup and rollback

### Backup

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7"
```

### Rollback options

1. **Full restore:** `pg_restore` / Supabase restore from backup timestamp
2. **Row-level reverse** using `party_repair_audit` + apply-before JSON:
   ```sql
   -- Example: reverse payment contact backfill
   UPDATE payments p SET contact_id = NULLIF(a.old_value, '')::uuid
   FROM party_repair_audit a
   WHERE a.table_name = 'payments' AND a.column_name = 'contact_id'
     AND a.row_id = p.id AND a.reason_code = 'BACKFILL_SALE_CUSTOMER';
   ```

Audit paths: `reports/single-core-ledger/remediation-apply-audit-*.json`

---

## 4. Risk assessment

| Factor | Assessment |
|--------|------------|
| Risk level | **Medium** — metadata only; no GL line amount changes if predicates correct |
| Downtime | None expected (row-level UPDATEs); recommend off-peak + backup first |
| GL impact | Payment contact aligns persisted metadata with runtime sale resolver; tie-out re-run required |
| Wrong customer poison | Excluded via `safe_apply` — wrong-party rows remain manual review |

---

## 5. Explicit confirmations required before prod

- [ ] Gate A **PASS** on clone (diagnostics 3/3 strict OR documented manual-review exceptions signed off)
- [ ] DIN CHINA pilot tie-out **PASS** (6/6)
- [ ] All-company tie-out **PASS** (document pilot-scope limitations if any)
- [ ] `unified_ledger_engine` remains **OFF**
- [ ] Phase 2 screen wiring **not started**
- [ ] Phase 1.5 migrations to prod are a **separate** approval after Gate A
- [ ] Fresh dry-run SHA256 matches approved manifest
- [ ] Backup completed and verified

---

## 6. Approval record (fill on sign-off)

| Field | Value |
|-------|-------|
| Approver | _pending_ |
| Date | _pending_ |
| Dry-run SHA256 | _pending_ |
| Payment safe_apply count | _pending_ |
| Branch safe_apply count | _pending_ |
| Backup timestamp | _pending_ |
| Manual-review exceptions | FT-000287, FT-000309 (transfers) — branch TBD |

---

## 7. Related documents

- [`SINGLE_CORE_LEDGER_PHASE_1_6_REMEDIATION_PLAN.md`](./SINGLE_CORE_LEDGER_PHASE_1_6_REMEDIATION_PLAN.md)
- [`SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md`](./SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md)
- [`SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md`](./SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md)
