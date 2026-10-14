# Single Core Ledger — Phase 1.6.2 Fresh Clone Validation Report

**Branch:** `feature/single-core-ledger-phase-1-6-2-production-approval`  
**Fresh clone:** `ledger_stage_20260623_prodcheck`  
**Run at:** 2026-06-23T18:10:32Z  
**VPS repo:** `/root/NEWPOSV3-phase-162-prodcheck`  
**Status:** **FRESH CLONE GATE A PASSED** — production remediation approval pack ready (proposal only)

---

## Why fresh clone was required

| Issue with `ledger_stage_20260623` | Fresh prodcheck resolves |
|-----------------------------------|--------------------------|
| Already remediated (74+8 updates applied) | Unremediated snapshot from current `postgres` |
| Stale vs live production | New dump @ 2026-06-23 ~18:10 UTC |
| Cannot prove current prod row IDs | Pre-apply inventory matches production UUIDs |

---

## Pre-apply counts (fresh clone, unremediated)

| Metric | Fresh prodcheck | Phase 1.6 baseline (2026-06-23) | Delta |
|--------|----------------:|--------------------------------:|------:|
| Payment contact gaps | **74** | 74 | **0** |
| Branch attribution risk | **8** | 8 | **0** |
| Branch manual_review | 6 | 6 | 0 |
| Branch safe_apply (auto) | 2 | 2 | 0 |

**Comparison recommendation:** `APPROVE_MANIFEST` (counts match baseline; production data unchanged since original clone snapshot)

---

## Remediation applied on fresh clone only

| Step | Rows updated |
|------|-------------:|
| Phase 1.6 payment contact backfill | **74** |
| Phase 1.6 branch auto apply | **2** |
| Phase 1.6.1 branch manual apply | **6** |
| **Total metadata updates** | **82** |

Production `postgres`: **NOT mutated**

---

## Post-remediation Gate A (fresh clone)

| Check | Result |
|-------|--------|
| `payments_missing_contact_sale_linked` | **0** |
| `payments_wrong_party_attribution` | **0** |
| `branch_attribution_risk` | **0** |
| Strict diagnostics | **3/3 PASS** |
| DIN CHINA pilot tie-out | **PASS** 9/9 |
| All-company tie-out | **PASS** 9/9 |
| `unified_ledger_engine` | **OFF** |

Diagnostics SHA256: `03fb391947d990722732cd9e9c5aa294723e39cffeadad6a9c2d599359efef25`

---

## Production approval manifest (proposal only)

| Artifact | Path |
|----------|------|
| JSON | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json` |
| CSV | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.csv` |
| SHA256 | `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd` |
| Baseline comparison | `reports/single-core-ledger/fresh-clone-comparison-2026-06-23T18-13-49-433Z.json` |
| Comparison SHA256 | `f70d6918dd573ab7d953238a6fd2ae33987c153a6aff3652509f2634edf85414` |
| Comparison recommendation | **APPROVE_MANIFEST** |

Expected production metadata updates after finance approval:

| Repair type | Count |
|-------------|------:|
| `payment_contact_backfill` | 74 |
| `branch_auto` | 2 |
| `branch_manual` | 6 |
| **Total** | **82** |

---

## Explicit boundaries (unchanged)

| Phase | Status |
|-------|--------|
| Production metadata apply | **Blocked** — requires `PRODUCTION_REMEDIATION_APPROVED=1` + backup |
| Phase 1.5 prod migrations | **Separate approval** after prod metadata passes |
| Phase 2 / `unified_ledger_engine` | **Not started** — remains OFF |

---

## Next steps

1. Finance sign-off on production approval manifest CSV
2. Run backup: `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7"`
3. Record backup ID in approval plan
4. Future: `PRODUCTION_REMEDIATION_APPROVED=1 PRODUCTION_BACKUP_ID=... node scripts/ledger-remediation/apply-production-remediation.mjs`
