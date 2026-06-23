# Single Core Ledger — Production Remediation Approval Plan

**Status:** PROPOSAL ONLY — no production execution  
**Prerequisite:** Gate A pass on fresh `ledger_stage_YYYYMMDD` clone after Phase 1.6 apply  
**Branch:** `feature/single-core-ledger-phase-1-6-remediation`

---

## 1. Scope

Apply **metadata-only** repairs validated on clone:

| Repair | Table | Column | Expected rows |
|--------|-------|--------|---------------|
| Payment contact backfill | `payments` | `contact_id` | ~74 |
| Branch attribution | `journal_entries` | `branch_id` | 0–8 (likely 4–6 safe + 2 transfer manual) |

**Out of scope:** AR/AP reclass, opening balance edits, void/reverse, GL line changes, `unified_ledger_engine` enablement, Phase 2 UI.

---

## 2. Exact row manifest

Production apply must use the **same SHA256 manifest** as the final clone dry-run JSON:

1. Create fresh clone: `ledger_stage_YYYYMMDD` from current production dump
2. Re-run `npm run remediation:dry-run` on fresh clone
3. Finance reviews `safe_apply` vs `manual_review` in CSV
4. Export payment IDs and JE IDs from approved dry-run JSON — attach to change ticket

**Rollback reference:** `party_repair_audit` rows with `reason_code` in (`payment_contact_backfill`, `branch_attribution_metadata`) + `remediation-apply-before-*.json`.

---

## 3. CLI plan (future — not implemented in Phase 1.6)

| Step | Command |
|------|---------|
| Backup | `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7"` |
| Fresh clone dry-run | Same env as clone validation against `ledger_stage_YYYYMMDD` |
| Apply | Clone scripts today; prod requires `PRODUCTION_REMEDIATION_APPROVED=1` + backup timestamp gate (Phase 1.6.1) |
| Re-validate | Diagnostics + pilot tie-out + all-company tie-out |

---

## 4. Rollback

1. **DB restore:** `pg_restore` / Supabase restore from backup taken immediately before apply
2. **Selective reverse** from audit JSON:
   ```sql
   UPDATE payments SET contact_id = NULL WHERE id IN (...);  -- from before snapshot
   UPDATE journal_entries SET branch_id = NULL WHERE id IN (...);
   ```

---

## 5. Risk assessment

| Factor | Level | Notes |
|--------|-------|-------|
| Data mutation | Medium | Row-level UPDATE only; predicates require NULL target column |
| GL impact | Low | Amounts unchanged; aligns persisted metadata with operational documents |
| Downtime | Low | No schema migration; recommend off-peak + backup |
| Reversibility | High | `party_repair_audit` + before JSON |

---

## 6. Explicit confirmations required before prod

- [ ] Gate A passed on clone with current production data snapshot
- [ ] Written approval from finance owner for `safe_apply` row list
- [ ] Transfer JEs (`FT-000287`, `FT-000309`) branch assignment signed off or documented exception
- [ ] DB backup completed and verified restorable
- [ ] `unified_ledger_engine` remains **OFF**
- [ ] Phase 1.5 migrations to production are a **separate** approval after Gate A
- [ ] Phase 2 screen wiring **not started**

---

## 7. Audit paths

- `reports/single-core-ledger/remediation-dry-run-*.json` (SHA256 manifest)
- `reports/single-core-ledger/remediation-apply-audit-*.json`
- `party_repair_audit` table (per-row before/after)

---

## 8. Approval record

| Field | Value |
|-------|-------|
| Approved by | _pending_ |
| Date | _pending_ |
| Dry-run SHA256 | _from final clone run_ |
| Backup ID | _pending_ |
