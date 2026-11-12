# Production schema_migrations audit — Single Core Ledger migration closure

**Run:** SINGLE CORE LEDGER MIGRATION CLOSURE + DB READINESS FINALIZATION  
**Date:** 2026-06-27T17:45:00Z  
**Method:** Read-only SQL on production `postgres` via VPS (`dincouture-vps`)  
**Writes performed:** None

---

## Summary

| Metric | Value |
|--------|-------|
| Production `schema_migrations` count | **559** |
| Repo `migrations/*.sql` count | **470** |
| Repo files missing from production | **0** |
| Production entries not in repo | **89** (legacy/bootstrap naming — pre-repo history) |
| Phase 1.5 canonical pack (4 files) | **4/4 APPLIED** |
| Unified ledger RPCs | **5/5 present** |

**Conclusion:** All repo migration files are recorded in production. No repo migration is pending apply. Single Core Ledger Phase 1.5 DB objects are live.

---

## Phase 1.5 canonical pack (authoritative allowlist)

| File | Production applied | Applied at (UTC) | SHA256 (repo file) |
|------|-------------------|------------------|-------------------|
| `20260620140000_get_unified_party_ledger_shadow.sql` | Yes | 2026-06-23 14:53:34 | `f222f208…ace1df` |
| `20260621120000_single_core_ledger_systemwide_diagnostics.sql` | Yes | 2026-06-23 14:53:34 | `030cc6d9…8c394d9` |
| `20260621150000_unified_ledger_phase_15_rpcs.sql` | Yes | 2026-06-23 14:53:35 | `fa6a2941…d6250f` |
| `20260621151000_unified_ledger_phase_15_indexes.sql` | Yes | 2026-06-23 14:53:35 | `2ebd63ec…f27bf9` |

Per [`SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md).

---

## Single Core Ledger program migration inventory (repo)

| File | Purpose | Destructive | Data/GL mutation | Production | Classification |
|------|---------|-------------|------------------|------------|----------------|
| `20260433_phase4_transaction_mutations_unified_feed.sql` | Phase 4 unified feed plumbing | No | No | Applied | **APPLIED** |
| `20260620140000_get_unified_party_ledger_shadow.sql` | Shadow RPCs party/account | No | No | Applied | **APPLIED** |
| `20260621120000_single_core_ledger_systemwide_diagnostics.sql` | Systemwide diagnostics RPC | No | No | Applied | **APPLIED** |
| `20260621150000_unified_ledger_phase_15_rpcs.sql` | Hardened unified RPCs | No | No | Applied | **APPLIED** |
| `20260621151000_unified_ledger_phase_15_indexes.sql` | JE/JEL/payment indexes | No | No | Applied | **APPLIED** |
| `20260621120000_drop_duplicate_party_gl_balances_overload.sql` | DROP FUNCTION overload fix | Yes (function) | No | Applied | **APPLIED** (excluded from Phase 1.5 bundle; already on prod) |

---

## RPC presence check (production)

```
get_single_core_ledger_systemwide_diagnostics
get_unified_account_ledger
get_unified_cash_bank_ledger
get_unified_party_ledger
get_unified_trial_balance
```

**5/5 PASS** — verified via `scripts/single-core-ledger/verify-phase-15-rpcs.sql`.

---

## Not migrations (excluded from apply scope)

| Category | Location | Classification |
|----------|----------|----------------|
| Feature flag enable/rollback SQL | `scripts/single-core-ledger/din-bridal/r5-enable-*.sql`, phase-21x enable SQL | **NOT MIGRATIONS** — ops rollout only |
| Read-only audits | `r5-monitoring-flags-pipe.sql`, `r3-readonly-*.sql` | **NOT MIGRATIONS** |
| GL remediation / data repair | `scripts/ledger-remediation/` | **BLOCKED** — separate approval |
| R7 roznamcha_payment RPC | Design doc only — **no migration file in repo** | **DESIGN_ONLY** |
| R8 legacy engine retirement | No approved migration pack | **BLOCKED** |

---

## Extra-in-production (not in repo)

**89** entries — legacy bootstrap files (`02_clean_erp_schema.sql`, etc.) and VPS-applied files with names not matching current repo filenames. **Not blocking:** all **470** current repo migrations are present in production. No action required for migration closure.

---

## Repo vs production diff

- **missing_from_production:** `[]` (empty)
- **extra_in_production_count:** 89 (historical; documented in JSON manifest)
