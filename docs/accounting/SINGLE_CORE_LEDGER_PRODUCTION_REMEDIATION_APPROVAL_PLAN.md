# Single Core Ledger — Production Remediation Approval Plan

**Status:** PROPOSAL ONLY — no production execution  
**Prerequisite:** Gate A pass on fresh `ledger_stage_YYYYMMDD` clone (achieved on `ledger_stage_20260623` @ 2026-06-23)  
**Branch:** `feature/single-core-ledger-phase-1-6-1-branch-resolution`

---

## 1. Scope

Apply **metadata-only** repairs validated on clone:

| Repair | Table | Column | Clone validated | Prod estimate |
|--------|-------|--------|-----------------|---------------|
| Payment contact backfill | `payments` | `contact_id` | **74 rows** | Re-count on fresh clone |
| Branch attribution (auto safe_apply) | `journal_entries` | `branch_id` | **2 rows** (Phase 1.6) | Re-count |
| Branch manual assignment (operator) | `journal_entries` | `branch_id` | **6 rows** (Phase 1.6.1) | Same manifest after fresh clone |

**Out of scope:** AR/AP reclass, opening balance edits, void/reverse, GL line changes, `unified_ledger_engine` enablement, Phase 2 UI, Phase 1.5 production migrations.

---

## 2. Exact row manifest

Production apply must use manifests from a **fresh** `ledger_stage_YYYYMMDD` clone of current production:

1. Create fresh clone from production dump
2. Re-run Phase 1.6 dry-run + apply (payment contact)
3. Re-run Phase 1.6.1 inventory + finance manifest review
4. Attach approved JSON SHA256 manifests to change ticket

### Payment contact (Phase 1.6 — validated)

- **74 rows** — `payments.contact_id ← sales.customer_id` where sale-linked and NULL
- Audit: `party_repair_audit` reason `payment_contact_backfill`

### Branch manual assignment (Phase 1.6.1 — validated on clone)

| Company | entry_no | approved_branch | operator note summary |
|---------|----------|-----------------|----------------------|
| DIN BRIDAL | JE-0204, JE-0170 | HQ — Main Branch | Walk-in manual_receipt → Main Branch |
| DIN CHINA | JE-0309, JE-0287 | BL0002 — DIN CHINA | Sole active branch |
| DIN CHINA | FT-000287, FT-000309 | BL0002 — DIN CHINA | Company bank transfer → sole branch (finance override) |

Manifest SHA256 (clone): see `reports/single-core-ledger/branch-manual-review-approved-2026-06-23T15-48-29-720Z.json`

**Rollback reference:** `party_repair_audit` + `branch-manual-apply-before-*.json`

---

## 3. CLI plan (future — separate Phase 1.6.2 prod apply)

| Step | Command |
|------|---------|
| Backup | `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7"` |
| Fresh clone | `bash scripts/single-core-ledger/create-vps-ledger-clone.sh` |
| Phase 1.6 payment apply | `REMEDIATION_APPLY_CONFIRM=1 node scripts/ledger-remediation/apply-payment-contact-backfill-clone.mjs ...` |
| Phase 1.6.1 branch apply | `REMEDIATION_APPLY_CONFIRM=1 node scripts/ledger-remediation/apply-manual-branch-assignment-clone.mjs --approved-manifest ... --expected-count 6` |
| Re-validate | `bash scripts/ledger-remediation/run-gate-a-clone-only.sh` |
| Production | Requires `PRODUCTION_REMEDIATION_APPROVED=1` + backup timestamp gate (not implemented) |

---

## 4. Rollback

1. **DB restore:** `pg_restore` / Supabase restore from backup taken immediately before apply
2. **Selective reverse** from audit JSON:
   ```sql
   UPDATE payments SET contact_id = NULL WHERE id IN (...);
   UPDATE journal_entries SET branch_id = NULL WHERE id IN (...);
   ```

---

## 5. Risk assessment

| Factor | Level | Notes |
|--------|-------|-------|
| Data mutation | Medium | Row-level UPDATE only; predicates require NULL target column |
| GL impact | Low | Amounts unchanged; metadata branch assignment only |
| Downtime | Low | No schema migration; recommend off-peak + backup |
| Reversibility | High | before/after JSON + party_repair_audit |
| Stale clone risk | High | Must re-run on fresh clone before prod |

---

## 6. Explicit confirmations required before prod

- [x] Gate A passed on clone (`ledger_stage_20260623` — 3/3 strict, tie-out PASS)
- [ ] Fresh clone from **current** production data re-validates same row counts
- [ ] Written approval from finance owner for payment + branch manifests
- [ ] DIN BRIDAL HQ branch assignment confirmed for JE-0204 / JE-0170
- [ ] DIN CHINA FT-* transfer branch assignment confirmed (BL0002 override)
- [ ] DB backup completed and verified restorable
- [ ] `unified_ledger_engine` remains **OFF**
- [ ] Phase 1.5 migrations to production are a **separate** approval
- [ ] Phase 2 screen wiring **not started**
- [ ] Production DB **not touched** until above confirmed

---

## 7. Audit paths

- `reports/single-core-ledger/remediation-dry-run-*.json`
- `reports/single-core-ledger/branch-manual-review-approved-*.json`
- `reports/single-core-ledger/branch-manual-apply-audit-*.json`
- `party_repair_audit` table

---

## 8. Approval record

| Field | Value |
|-------|-------|
| Approved by | _pending production approval_ |
| Clone Gate A date | 2026-06-23T15:50:06Z |
| Branch manifest SHA256 | `4e75c8b7cdfa0bf121f68793d8517593f72944a0ea47e755b05ebce44c0f0c4c` |
| Backup ID | _pending_ |
