# Single Core Ledger — Phase 0 & 1 Completion Report (Part G)

**Branch:** `feature/single-core-ledger-shadow`  
**Date:** 2026-06-20  
**Master plan:** [`SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md`](./SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md)

---

## 1. Summary

Phase 0 (read-only diagnostics + mapping) and Phase 1 (shadow unified RPC + TS service + developer tie-out UI) foundation delivered on branch `feature/single-core-ledger-shadow`.

**Production ledger screens were NOT replaced.**  
**Feature flag `unified_ledger_engine` defaults OFF.**  
**No live data mutated.**  
**No VPS deploy.**

---

## 2. Branch

```
feature/single-core-ledger-shadow
```

Created from current working tree. **Not merged to `main`.**

---

## 3. Files changed / added

### Documentation

| File | Part |
|------|------|
| [`SINGLE_CORE_LEDGER_ENGINE_MAPPING_REPORT.md`](./SINGLE_CORE_LEDGER_ENGINE_MAPPING_REPORT.md) | A |
| [`SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md`](./SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md) | B |
| [`SINGLE_CORE_LEDGER_MIGRATION.md`](./SINGLE_CORE_LEDGER_MIGRATION.md) | Prior analysis (reference) |
| This file | G |

### SQL (read-only diagnostics)

| File | Part |
|------|------|
| [`scripts/sql/single_core_ledger_phase0_diagnostics.sql`](../../scripts/sql/single_core_ledger_phase0_diagnostics.sql) | B |

### Migrations (additive RPC draft)

| File | Part |
|------|------|
| [`migrations/20260620140000_get_unified_party_ledger_shadow.sql`](../../migrations/20260620140000_get_unified_party_ledger_shadow.sql) | D |

New RPCs: `get_unified_party_ledger`, `get_unified_account_ledger`, helper `_unified_ledger_basis_includes_row`.  
**Old RPCs unchanged.**

### TypeScript (shadow only)

| File | Part |
|------|------|
| [`src/app/services/unifiedLedgerService.ts`](../../src/app/services/unifiedLedgerService.ts) | C |
| [`src/app/services/unifiedLedgerTieOutService.ts`](../../src/app/services/unifiedLedgerTieOutService.ts) | E |
| [`src/app/lib/unifiedLedgerBasisFilter.ts`](../../src/app/lib/unifiedLedgerBasisFilter.ts) | C/F |
| [`src/app/lib/unifiedLedgerFeatureFlag.ts`](../../src/app/lib/unifiedLedgerFeatureFlag.ts) | C |
| [`src/app/components/admin/UnifiedLedgerTieOutPage.tsx`](../../src/app/components/admin/UnifiedLedgerTieOutPage.tsx) | E |

### Wiring (developer route only)

| File | Change |
|------|--------|
| [`src/app/App.tsx`](../../src/app/App.tsx) | Route `/admin/unified-ledger-tieout` |
| [`src/app/services/featureFlagsService.ts`](../../src/app/services/featureFlagsService.ts) | `FEATURE_KEYS.UNIFIED_LEDGER_ENGINE` |

### Tests

| File | Part |
|------|------|
| [`src/app/lib/unifiedLedgerBasisFilter.test.ts`](../../src/app/lib/unifiedLedgerBasisFilter.test.ts) | F |
| [`src/app/lib/unifiedLedgerFeatureFlag.test.ts`](../../src/app/lib/unifiedLedgerFeatureFlag.test.ts) | F |

---

## 4. Migrations added

- `20260620140000_get_unified_party_ledger_shadow.sql` — **not applied to production** in this phase.

Apply on staging when ready:

```bash
node scripts/run-migrations.js
```

---

## 5. Tests run

```bash
npx tsx --test src/app/lib/unifiedLedgerBasisFilter.test.ts src/app/lib/unifiedLedgerFeatureFlag.test.ts
```

**Expected coverage:**

- `effective_party` hides `correction_reversal` (JE-0168 class)
- `audit_full_history` / `official_gl` include `correction_reversal`
- Void JEs excluded
- Feature flag default OFF

**Not run in CI yet** — add to `package.json` `test:unit` in Phase 2.

**Trial Balance debit=credit** — requires live DB integration test (Phase 2).

**Golden contact parity** — requires tie-out UI + DB with migration applied.

---

## 6. Diagnostics summary

Read-only SQL script ready. **Counts not executed against live DB in this session** (no VPS / no production DB connection).

Fill results using [`SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md`](./SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md) Section 4 template after running on staging.

---

## 7. Known differences (expected before Phase 0 apply)

| Old engine | New engine | Expected diff reason |
|------------|------------|----------------------|
| `getCustomerLedger` hybrid | `get_unified_party_ledger` | Synthetic sales/payments/rentals not in journal |
| `getCustomerArGlJournalLedger` | unified RPC | Basis filter + resolver parity (should be closer) |
| `customerLedgerAPI` operational | UCLE | Operational docs not in journal — by design |
| `effectivePartyLedgerService` | UCLE `effective_party` | PF-14 collapse not yet ported |

---

## 8. Risks still open

1. Migration not applied — RPC calls fail until `20260620140000` on database.
2. `_gl_resolve_party_id` regression for `reference_type=payment` without `contact_id`.
3. Worker party type uses 2010+1180 subtree — needs golden worker tie-out.
4. `get_unified_trial_balance` RPC deferred to Phase 2.
5. Cash/bank aggregate in TS loops accounts — performance TBD at scale.
6. CUS-0000 walk-in must not absorb general AR — verify per contact after migration apply.

---

## 9. What was NOT changed

- No deletion of `customerLedgerApi.ts`, `ledgerDataAdapters.ts`, `effectivePartyLedgerService.ts`, or hybrid `getCustomerLedger`.
- No changes to `AccountLedgerReportPage`, `LedgerHub`, `CustomerLedgerPageOriginal`, `EffectivePartyLedgerPage` production data paths.
- No data backfill, reclass, or posting.
- No VPS deploy.
- No commit to `main`.
- Feature flag remains **OFF** (no DB row created).

---

## 10. Feature flag confirmation

| Control | Default |
|---------|---------|
| `UNIFIED_LEDGER_ENGINE_DEFAULT` | `false` |
| DB `feature_flags.unified_ledger_engine` | No row = disabled |
| `getUnifiedPartyLedger` without `shadowForce` | Returns empty + `engine: 'disabled'` |
| Tie-out UI | Uses `shadowForce: true` only |

---

## 11. How to use tie-out UI

1. Apply migration on **staging** database.
2. Open `/admin/unified-ledger-tieout` (developer/admin role).
3. Select golden contact (JALIL, Inayat, Saqib, CUS-0000).
4. Choose basis `effective_party` or `audit_full_history`.
5. Run tie-out — review balance diff, missing/extra rows.

---

## 12. Next recommended phase

**Phase 2 (after staging diagnostics fill):**

1. Run `single_core_ledger_phase0_diagnostics.sql` on staging; record counts.
2. Apply approved data cleanup (payments.contact_id, Phase 4 reclass) — **separate PR**.
3. Add `get_unified_trial_balance` RPC sharing attribution CTE.
4. Wire `test:unit` for unified ledger tests.
5. Golden contact automated tie-out (integration test with service role in CI only).
6. 2–4 week shadow parallel run before any production screen switch.

---

*Phase 0–1 foundation complete — shadow mode only.*
