# Phase 2B — Build / typecheck blockers (Batch 3 gate)

**Updated:** 2026-03-29  
**Purpose:** Record validation commands, failures, fixes, and what still blocks confidence for repo cleanup (especially Batch 3 / `ledgerService.ts`).  
**Constraints:** No DB changes, no destructive SQL, `accountingCanonicalGuard.ts` untouched, no dangerous root scripts executed during this pass.

---

## 1. Validation commands run (authoritative)

| Command | Scope | Result (2026-03-29) |
|--------|--------|---------------------|
| `npm run build` | Root web app (`vite build`, `src/`) | **PASS** (exit 0) |
| `npm run typecheck:mobile` | `erp-mobile-app` (`tsc -b` only) | **PASS** after fixes (see below) |
| `npm run build` inside `erp-mobile-app/` | Mobile (`tsc -b && vite build`) | **PASS** after fixes |

**Note:** Root `package.json` does **not** ship TypeScript for the web tree; the web compile gate is **`vite build`**, not `tsc --noEmit` on `src/`. Adding a root `tsc` gate would require adding `typescript` as a devDependency and is **out of scope** for this pass.

---

## 2. Files / trees checked

- Root: `src/` (via Vite build)
- Mobile: `erp-mobile-app/src/**/*.ts(x)` (via `erp-mobile-app` `tsconfig` + `tsc -b`)
- Batch 3 candidate: `src/app/services/ledgerService.ts` (import scan only; **not deleted** in this pass)

---

## 3. Initial failures (before fixes)

**Command:** `cd erp-mobile-app && npm run build`  
**Outcome:** **FAIL** (TypeScript errors only; no errors referenced deleted Batch 2 paths).

### 3a. Grouped by module (initial)

| Area | Representative errors | Likely cause |
|------|-------------------------|--------------|
| `src/api/employees.ts` | `throwOnError(false)` — expected 0 arguments; `error` typed `never` | Supabase `postgrest-js`: `throwOnError()` takes no args |
| `src/api/studio.ts` | Wrong `getStudioStages` return shape (`.data` on array); unsafe `null` RPC casts; row shape vs `StudioStageRow` | API typing / PostgREST nested objects as arrays |
| `src/api/products.ts` | `product_categories` array vs object in cast | Supabase join shape |
| `src/api/rentals.ts` | `paymentDate` inferred `{}`; unused `companyId` | Loose row typing; reserved params |
| `src/api/settings.ts` | `forEach` callback param vs `ModuleConfigRow` | Inferred select row missing `company_id` |
| `src/api/sales.ts` | Unused `orderDate` in destructuring | `noUnusedLocals` |
| `src/api/accounts.ts` | Unused `companyId` in `getAccountLedger` | `noUnusedLocals` |
| `src/components/sales/SalesModule.tsx` | `SalesStep` missing `'studioDetails'` | Type union drift vs runtime |
| `src/components/studio/*` | `in_progress` vs `in-progress` | DB enum vs UI union |
| `src/components/shared/TransactionSuccessModal.tsx` | `(onBack \|\| onClose)` always truthy | `onClose` is required prop |
| Various components | TS6133 unused imports/locals | `noUnusedLocals` / dead helpers |

### 3b. Batch 2 cleanup correlation

- **None** of the initial errors pointed at removed `AccountingModule` paths.
- Classification: **(a) pre-existing mobile TypeScript debt**, not **(b) regressions from Batch 2**.

---

## 4. Fixes applied (low-risk, local)

- **Supabase:** Removed invalid `.throwOnError(false)` calls (`employees.ts`).
- **Unused parameters/locals:** `_companyId`, `_orderDate`, omitted unused destructuring, `_user` / `_branch` pattern, removed dead `openItemsForSale`.
- **Narrow typing:** `SalesStep` includes `'studioDetails'`; `AddAccountForm` uses `AccountTypeValue` for account type state.
- **Studio:** Map API `in_progress` → UI `in-progress` in `mapProductionToOrder`; fix `getStudioStages` consumers to use `{ data: StudioStageRow[] }` correctly; `unknown` casts for RPC payloads and embedded relations.
- **Products:** `unknown` cast + normalize `product_categories` as object or first element of array.
- **Rentals:** Normalize `paymentDate` to string via `typeof` / `Date` handling.
- **Settings:** Drop incorrect `ModuleConfigRow` annotation on inferred row type.
- **TransactionSuccessModal:** Always render Back actions (required `onClose` makes `||` checks redundant and triggered TS2774).

**Files touched:** see git history for this commit; all paths under `erp-mobile-app/src/` listed in the Phase 2B execution report update.

---

## 5. After-fix validation

| Command | Result |
|---------|--------|
| `npm run build` (root) | **PASS** |
| `npm run typecheck:mobile` | **PASS** |
| `cd erp-mobile-app && npm run build` | **PASS** |

**Remaining blockers for a “full monorepo `tsc` gate”:** root web app still has **no** `typescript` devDependency / `tsc --noEmit` for `src/`. For Batch 3, the **documented gate** is: **root `vite build` + mobile `tsc -b`**.

---

## 6. `ledgerService.ts` — zero-import proof (re-checked)

```bash
rg -n "ledgerService\\.ts|services/ledgerService|/ledgerService|\\\\ledgerService" src
rg -n "from\\(['\\\"].*ledgerService['\\\"]\\)" src
rg -n "getOrCreateLedger\\(" src
rg -n "getLedgerEntries\\(" src
```

- No import sites under `src/` for `ledgerService`.
- `getOrCreateLedger(` / `getLedgerEntries(` appear only inside `src/app/services/ledgerService.ts`.

---

## 7. Classification (Batch 3) — updated 2026-03-30

**Batch 3 executed:** `src/app/services/ledgerService.ts` **REMOVED**. See [PHASE2B_BATCH3_EXECUTED.md](./PHASE2B_BATCH3_EXECUTED.md).

(Historical note: prior classification was **READY_FOR_BATCH3_DELETE** until the final delete PR.)

---

## 8. Explicit confirmations (this pass)

- **No DB changes** (no migrations, no SQL executed against databases).
- **`src/app/services/accountingCanonicalGuard.ts`** — not modified.
- **Dangerous root scripts** (`complete-migration.js`, `verify-migration.js`, `remove-duplicate-accounting-tables.js`, etc.) — **not** executed.
