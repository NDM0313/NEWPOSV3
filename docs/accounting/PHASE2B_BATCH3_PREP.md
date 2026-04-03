# Phase 2B — Batch 3 prep & outcome

**Updated:** 2026-03-30  
**Scope:** Historical prep notes + **final outcome**: legacy stub removed.

**Execution record:** [PHASE2B_BATCH3_EXECUTED.md](./PHASE2B_BATCH3_EXECUTED.md)

---

## Candidate (historical): `src/app/services/ledgerService.ts`

**Status:** **REMOVED** (2026-03-30). The file no longer exists in the repo.

Former purpose:

- No-op stubs for retired duplicate supplier/user subledger (`ledger_master`, `ledger_entries`).

---

## Proof: zero-import candidate (repo scan) — pre-delete baseline

### Proof A — No import sites by name

```bash
rg -n "ledgerService\\.ts|services/ledgerService|/ledgerService|\\\\ledgerService" src
rg -n "from\\(['\\\"].*ledgerService['\\\"]\\)" src
```

Result (before delete):

- No matches in `src/**/*.ts(x)` (imports/re-exports not present).

### Proof B — No functional call sites (stub-specific)

```bash
rg -n "getOrCreateLedger\\(" .
rg -n "getLedgerEntries\\(" .
rg -n "addLedgerEntry\\(" .
```

Result (before delete):

- `getOrCreateLedger(` → only `src/app/services/ledgerService.ts`
- `getLedgerEntries(` → only `src/app/services/ledgerService.ts`
- `addLedgerEntry(` → employee ledger only (`employeeService`, `EmployeesTab`, `erp-mobile-app` employees) — **not** the deleted stub

---

## Safety gate (pre-delete)

1. Zero-import proof — **PASS**
2. Build gate — **MET** (`npm run build`, `npm run typecheck:mobile`, `erp-mobile-app` `npm run build`)

Post-delete validation (2026-03-30): **all PASS** — see [PHASE2B_BATCH3_EXECUTED.md](./PHASE2B_BATCH3_EXECUTED.md).

---

## Classification (final)

- **Batch 3:** **COMPLETE**
- **`ledgerService.ts`:** **REMOVED**
- **Next:** Batch 4 DB inventory (read-only only) — `PHASE2B_CLEANUP_BATCHES.md`, `PHASE2B_ROLLBACK_AND_SAFETY.md`

`src/app/services/accountingCanonicalGuard.ts` was **not** modified in Batch 3.

---

## Root/prototype script safety prep (documentation only)

Unchanged from prior prep: root scripts `complete-migration.js`, `verify-migration.js`, `remove-duplicate-accounting-tables.js` were **not** executed during Batch 3.

Candidate scripts (repo root):

- `complete-migration.js`
- `verify-migration.js`
- `remove-duplicate-accounting-tables.js`

### Proof: no runtime imports or package script wiring

```bash
rg -n "(from\\s+['\\\"][^'\\\"]*(complete-migration\\.js|verify-migration\\.js|remove-duplicate-accounting-tables\\.js)[^'\\\"]*['\\\"])|(import\\s+.*(complete-migration|verify-migration|remove-duplicate-accounting-tables))|(require\\(.*(complete-migration|verify-migration|remove-duplicate-accounting-tables))" .
rg -n "complete-migration\\.js|verify-migration\\.js|remove-duplicate-accounting-tables\\.js" package.json
```

Result:

- No JS/TS import/require references in runtime code (`src/` and `erp-mobile-app/src/`).
- No `package.json` scripts reference these files.

### Recommendation (unchanged)

- **ARCHIVE_LATER** if the repo owner wants clearer labeling (`tools/legacy-accounting/`, `DANGEROUS_*` prefix).

Explicit confirmation:

- None of these scripts were executed in Batch 3.
