# Phase 2B — Batch 3 prep (legacy code reference prep only)

**Updated:** 2026-04-01  
**Scope:** Repo evidence + readiness notes only. No deletion executed in Batch 3 during this pass.

---

## Candidate: `src/app/services/ledgerService.ts`

File:

- [ledgerService.ts](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/src/app/services/ledgerService.ts)

Purpose (current state):

- Explicit no-op stubs for retired duplicate supplier/user subledger (`ledger_master`, `ledger_entries`) to avoid creating duplicate rows.
- This is aligned with the Phase 2B freeze posture: legacy `ledger_*` is not used by runtime app.

---

## Proof: zero-import candidate (repo scan)

### Proof A — No import sites by name

Search patterns (ripgrep equivalents; under `src/`):

```bash
rg -n "ledgerService\\.ts|services/ledgerService|/ledgerService|\\\\ledgerService" src
rg -n "from\\(['\\\"].*ledgerService['\\\"]\\)" src
```

Result:

- No matches found in `src/**/*.ts(x)` (imports/re-exports not present).

### Proof B — No functional call sites

Search patterns (ripgrep equivalents; repo-wide to avoid name collisions):

```bash
rg -n "getOrCreateLedger\\(" .
rg -n "getLedgerEntries\\(" .
rg -n "addLedgerEntry\\(" .
```

Result:

- `getOrCreateLedger(` → only match is `src/app/services/ledgerService.ts`
- `getLedgerEntries(` → only match is `src/app/services/ledgerService.ts`
- `addLedgerEntry(` → multiple matches exist, but they are unrelated employee-ledger functions:
  - `src/app/services/employeeService.ts`
  - `src/app/components/settings/EmployeesTab.tsx`
  - `erp-mobile-app/src/api/employees.ts`
  - `erp-mobile-app/src/components/settings/EmployeesSection.tsx`

---

## Safety gate status (why we did not delete in this pass)

Batch 3 deletion is allowed only with:

1. Zero-import proof (PASS)
2. Clean build/typecheck gate (NOT MET)

Reason:

- `erp-mobile-app` `npm run build` currently fails due to unrelated TypeScript errors, so this pass cannot establish a clean compile baseline.
- Root app does not expose a dedicated `typecheck` script, so deleting shared files without a known CI gate is deferred.

Decision:

- Keep `src/app/services/ledgerService.ts` unchanged in this run.

---

## Recommended next step (to enable safe Batch 3 execution later)

- Establish a “clean build” gate for the web app (e.g., add/confirm a `typecheck` script or CI step).
- Fix existing mobile TypeScript errors until `erp-mobile-app npm run build` is clean.
- Re-run the zero-import proof scans and then delete `src/app/services/ledgerService.ts` in a dedicated Batch 3 PR.

---

## Classification

- **SAFE_REMOVE_LATER** (zero-import proof is clean; deletion deferred until a clean build/typecheck gate exists)

Explicit constraint confirmation:

- `src/app/services/accountingCanonicalGuard.ts` was not modified or removed in this pass.

---

## Root/prototype script safety prep (documentation only)

Candidate scripts (repo root):

- `complete-migration.js`
- `verify-migration.js`
- `remove-duplicate-accounting-tables.js`

### Proof: no runtime imports or package script wiring

Search patterns (ripgrep equivalents):

```bash
rg -n "(from\\s+['\\\"][^'\\\"]*(complete-migration\\.js|verify-migration\\.js|remove-duplicate-accounting-tables\\.js)[^'\\\"]*['\\\"])|(import\\s+.*(complete-migration|verify-migration|remove-duplicate-accounting-tables))|(require\\(.*(complete-migration|verify-migration|remove-duplicate-accounting-tables))" .
rg -n "complete-migration\\.js|verify-migration\\.js|remove-duplicate-accounting-tables\\.js" package.json
```

Result:

- No JS/TS import/require references found in runtime code (`src/` and `erp-mobile-app/src`).
- No `package.json` scripts reference these files.

### Proof: references are documentation-only “manual run” instructions

Search pattern:

```bash
rg -n "node\\s+(\\./)?(complete-migration\\.js|verify-migration\\.js|remove-duplicate-accounting-tables\\.js)\\b" .
```

Result:

- `MIGRATION_SUCCESS.md` contains `node verify-migration.js` instructions.
- `complete-migration.js` prints “Run: node verify-migration.js”.
- `remove-duplicate-accounting-tables.js` is referenced in docs/history as a destructive tool, not imported by app runtime.

### Recommendation (prep only; no move in this pass)

- **ARCHIVE_LATER**: keep scripts in repo root for history, but consider a future repo-owner-approved move to a clearly labeled folder, e.g.:
  - `tools/legacy-accounting/` or `scripts/legacy-prototypes/`
  - Prefix: `DANGEROUS_` (e.g., `DANGEROUS_remove-duplicate-accounting-tables.js`)

Explicit confirmation:

- None of these scripts were executed in this pass.
