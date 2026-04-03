# Phase 2B — Batch 3 executed (ledgerService.ts removal)

**Date:** 2026-03-30  
**Scope:** Repo-only deletion of legacy stub `src/app/services/ledgerService.ts`.  
**Constraints honored:** No DB changes, no SQL, protected live accounting spine untouched, `accountingCanonicalGuard.ts` not modified, no dangerous root scripts executed.

---

## Status

| Item | Result |
|------|--------|
| Batch 3 | **COMPLETE** |
| `src/app/services/ledgerService.ts` | **REMOVED** |
| Next recommended step | **Batch 4** — DB legacy inventory (read-only; no DROP) per `PHASE2B_CLEANUP_BATCHES.md` |

---

## 1. Grep commands used (pre-delete)

Equivalent ripgrep (Cursor `Grep` used the same patterns over `*.{ts,tsx}` where noted):

```bash
# String "ledgerService" in web app TS/TSX (import path / comment detection)
rg -n "ledgerService" src --glob "*.ts" --glob "*.tsx"

# Or workspace TS/TSX
rg -n "ledgerService" . --glob "*.ts" --glob "*.tsx"

rg -n "getOrCreateLedger" . --glob "*.ts" --glob "*.tsx"
rg -n "getLedgerEntries" . --glob "*.ts" --glob "*.tsx"
rg -n "addLedgerEntry" . --glob "*.ts" --glob "*.tsx"
```

---

## 2. Grep results (before deletion)

| Pattern | Result |
|---------|--------|
| `ledgerService` in `src/**/*.ts(x)` | **No matches** (no import strings / path references in other files; filename alone is not content) |
| `getOrCreateLedger` | **Only** `src/app/services/ledgerService.ts` |
| `getLedgerEntries` | **Only** `src/app/services/ledgerService.ts` |
| `addLedgerEntry` | **Multiple** — `employeeService`, `EmployeesTab`, `erp-mobile-app` employees API/UI (**employee ledger**); **not** imports of deleted stub |

Conclusion: zero-import proof **PASS**; `addLedgerEntry` elsewhere is unrelated naming.

---

## 3. File action

- **Deleted:** `src/app/services/ledgerService.ts`

---

## 4. Validation commands (post-delete)

```bash
npm run build
npm run typecheck:mobile
cd erp-mobile-app && npm run build
```

---

## 5. Validation results (post-delete)

| Command | Exit / result |
|---------|----------------|
| `npm run build` (root) | **PASS** (exit 0) |
| `npm run typecheck:mobile` | **PASS** (exit 0) |
| `cd erp-mobile-app && npm run build` | **PASS** (exit 0) |

---

## 6. Grep results (post-delete)

| Pattern | TS/TSX runtime tree |
|---------|---------------------|
| `ledgerService` | **No matches** under `src/` or `erp-mobile-app/src/` in `.ts`/`.tsx` content |
| `getOrCreateLedger` | **No matches** |
| `getLedgerEntries` | **No matches** |
| `addLedgerEntry` | Still present on **employee** paths only (expected) |

**Docs** under `docs/` may still mention `ledgerService` historically; no runtime code imports the removed file.

---

## 7. Rollback

**Yes — simple git revert** of the commit that deletes `src/app/services/ledgerService.ts` (or `git checkout <commit> -- src/app/services/ledgerService.ts` from prior revision).

---

## 8. Explicit confirmations

- **No DB changes** — no migrations, no SQL executed against databases.
- **`src/app/services/accountingCanonicalGuard.ts`** — **not modified** in this batch.
- **Dangerous root scripts** — **not executed** (`complete-migration.js`, `verify-migration.js`, `remove-duplicate-accounting-tables.js`, etc.).

---

## 9. Final classification

- **Batch 3:** COMPLETE  
- **`ledgerService.ts`:** REMOVED  
- **Next:** Batch 4 DB inventory review (read-only only), per `PHASE2B_ROLLBACK_AND_SAFETY.md` / `PHASE2B_CLEANUP_BATCHES.md`
