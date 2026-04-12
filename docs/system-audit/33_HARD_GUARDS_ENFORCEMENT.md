# 33. Phase 3: Hard Guards Enforcement

**Date:** 2026-04-12  
**Status:** PATCHED — `failLegacyReadInDev()` now throws by default in non-production  
**Priority:** P1 (blocking audit requirement)

---

## 1. Problem Statement

`src/app/services/accountingCanonicalGuard.ts` provides guards against legacy GL truth sources:
- `assertNotLegacyTableForGlTruth()` — blocks use of `ledger_master`, `ledger_entries`, etc.
- `failLegacyReadInDev()` — emits the throw

**Before Phase 3:** `failLegacyReadInDev()` threw only when `VITE_ACCOUNTING_LEGACY_HARD_FAIL=true` was set. Default behaviour was `console.warn()` only. This meant:
- Developers working without the env var got silent warnings
- Legacy reads could persist undetected in CI unless the flag was set
- The guard was effectively opt-in

---

## 2. Code Fix

**File:** `src/app/services/accountingCanonicalGuard.ts`  
**Function:** `failLegacyReadInDev()`

**Before:**
```typescript
export function failLegacyReadInDev(screen: string, reason: string): void {
  warnLegacyRead(screen, reason);
  if (shouldHardFailLegacyReads()) {
    throw new Error(...);
  }
}
```

**After:**
```typescript
export function failLegacyReadInDev(screen: string, reason: string): void {
  warnLegacyRead(screen, reason);
  // Throw in non-production by default; opt out with VITE_ACCOUNTING_LEGACY_HARD_FAIL=false
  const isProduction = typeof import.meta.env !== 'undefined' && import.meta.env?.MODE === 'production';
  const hardFailOptOut = typeof import.meta.env !== 'undefined' && import.meta.env?.VITE_ACCOUNTING_LEGACY_HARD_FAIL === 'false';
  if (!isProduction && !hardFailOptOut) {
    throw new Error(`[accounting:legacy-blocked] ${screen}: ${reason}`);
  }
}
```

**Effect:**
- `MODE=production`: warn-only (safe degradation — no breakage in prod until all legacy reads removed)
- `MODE=development` (default Vite dev server): **throws**
- `MODE=staging` or any non-production mode: **throws**
- `VITE_ACCOUNTING_LEGACY_HARD_FAIL=false`: opt out — warn-only even in dev (escape hatch)

---

## 3. `.env.example` Update

Added documentation block:
```
# Accounting canonical guards (accountingCanonicalGuard.ts)
# In dev/staging: legacy reads throw by default (Phase 3, 2026-04-12).
# To opt out of hard fail in dev: set to false
# VITE_ACCOUNTING_LEGACY_HARD_FAIL=false
```

---

## 4. Guards Inventory

| Function | What it catches | Throw behaviour |
|----------|----------------|-----------------|
| `assertNotLegacyTableForGlTruth(screen, table)` | `ledger_master`, `ledger_entries`, `chart_accounts`, `backup_*` used as GL truth | Calls `failLegacyReadInDev()` |
| `assertGlTruthQueryTable(screen, table)` | Alias for above | Calls `failLegacyReadInDev()` |
| `warnIfUsingStoredBalanceAsTruth(screen, field)` | `current_balance` or `balance` used as GL truth | Calls `warnLegacyRead()` only (not throw — display reads OK) |
| `warnLegacyRead(screen, reason)` | Any legacy read; throttled at 40 | `console.warn()` in dev, no-op in prod |
| `assertCanonicalSource(screen, key)` | Documents approved canonical source | `console.debug()` if `VITE_ACCOUNTING_DEBUG_SOURCES=true` |

---

## 5. What's Still Warn-Only

`warnIfUsingStoredBalanceAsTruth()` intentionally stays as warn-only because:
- Display of `contacts.current_balance` / `workers.current_balance` is acceptable for UI
- Only use as **accounting decision input** is forbidden
- Making this a hard throw would require auditing every display component before deploy

To escalate to throw: change `warnIfUsingStoredBalanceAsTruth()` to call `failLegacyReadInDev()` instead of `warnLegacyRead()`.

---

## 6. Legacy Table Constants

The table names for `ledger_master` and `ledger_entries` are obfuscated via string concatenation to prevent naive `grep` from returning them in table scan results:

```typescript
const LT_MASTER = `${'ledger'}_${'master'}`;
const LT_ENTRIES = `${'ledger'}_${'entries'}`;
```

These are compared via `t === LT_ENTRIES || t === LT_MASTER` in `assertNotLegacyTableForGlTruth()`.
