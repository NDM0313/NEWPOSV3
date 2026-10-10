# Approved pending migration allowlist — Single Core Ledger

**Run:** SINGLE CORE LEDGER MIGRATION CLOSURE + DB READINESS FINALIZATION  
**Date:** 2026-06-27T17:45:00Z  
**Status:** `NO_APPROVED_PENDING_MIGRATIONS`

---

## Result

No approved pending migrations exist for apply in this run.

All Single Core Ledger program migrations required for DIN CHINA and DIN BRIDAL unified loader operation are **already applied** on production (Phase 1.5 pack 4/4, unified RPCs 5/5, repo migrations 470/470 present in `schema_migrations`).

---

## Explicit exclusions from allowlist

| Item | Reason | Classification |
|------|--------|----------------|
| R7 `roznamcha_payment` RPC migration | No migration file; design doc only; no separate approval | **DESIGN_ONLY** |
| R8 legacy engine retirement | Blocked until all approved companies stable | **BLOCKED** |
| `20260621120000_drop_duplicate_party_gl_balances_overload.sql` | Already applied on production; not pending | **APPLIED** (not pending) |
| Feature flag SQL (`r5-enable-*`, phase-21x enable) | Not schema migrations; ops rollout | **EXCLUDED** |
| GL remediation scripts (`scripts/ledger-remediation/`) | Data mutation; separate approval | **BLOCKED** |
| Other-company rollout flag SQL | Not migration closure scope | **EXCLUDED** |

---

## Approved pending migrations

**None.**

---

## Next action

Proceed to migration closure final report. **Do not apply any SQL to production.**
