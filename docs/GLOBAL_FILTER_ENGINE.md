# Global Filter Engine — DIN COUTURE ERP

Centralized date range and branch filters controlled from **TopHeader**. Same filters apply across all modules; state **persists** when navigating (localStorage). No per-page filter duplication.

---

## 1. Architecture

- **Single source of truth:** `GlobalFilterContext` holds `dateRangeType`, `customStartDate`, `customEndDate`, `branchId`.
- **TopHeader** is the only UI that changes these (date dropdown + branch dropdown when multi-branch).
- **All modules** read from `useGlobalFilter()` and use `startDate`, `endDate`, `branchId` for queries and lists.
- **Persistence:** Stored under `localStorage` key `erp-global-filters`. Restored on load; branch is also synced to `SupabaseContext` so existing `branchId` usage keeps working.

---

## 2. Context Usage

**Hook:** `useGlobalFilter()`

**Provided:**

| Member | Type | Description |
|--------|------|-------------|
| `dateRangeType` | `GlobalDateRangeType` | Effective preset (or module default). |
| `customStartDate` / `customEndDate` | `string \| null` | For custom range (YYYY-MM-DD). |
| `startDate` / `endDate` | `string` | ISO date range for queries. |
| `startDateObj` / `endDateObj` | `Date` | Same range as `Date` for UI. |
| `branchId` | `string \| null` | Selected branch; `'all'` or `null` = all branches. |
| `currentModule` | `GlobalFilterModule` | Set by pages for default logic. |
| `setDateRangeType(type)` | function | Set preset (persists). |
| `setCustomDateRange(start, end)` | function | Set custom range (persists). |
| `setBranchId(id)` | function | Set branch (persists + syncs Supabase). |
| `setCurrentModule(module)` | function | Set current module (dashboard vs others). |
| `getDateRangeLabel()` | function | Human-readable label (e.g. "Last 30 Days"). |

**Example in a module:**

```tsx
const { startDate, endDate, branchId, setCurrentModule } = useGlobalFilter();

useEffect(() => {
  setCurrentModule('sales'); // or 'dashboard', 'purchases', 'reports', etc.
}, [setCurrentModule]);

// Use startDate, endDate in API calls and filters
const filtered = items.filter((i) => {
  const d = new Date(i.date);
  return d >= new Date(startDate) && d <= new Date(endDate);
});
```

---

## 3. Date Presets

Supported `dateRangeType` values:

- `today`
- `last7days`
- `last15days`
- `last30days`
- `last90days`
- `thisWeek`
- `thisMonth`
- `thisYear`
- `fromStart` (10 years back)
- `customRange` (uses `customStartDate` / `customEndDate`)

Custom range is set via the existing date picker in TopHeader (opens when user selects "Custom Range").

---

## 4. Default Filter Rules (Module-Based)

- **Dashboard:** If no saved filter → default `last7days`.
- **All other modules:** If no saved filter → default `last30days`.

"Saved filter" = any value already in `localStorage` for `erp-global-filters`. User’s explicit choice is never overwritten by module defaults.

---

## 5. Branch Filter Rule

- **Single branch:** Branch selector is hidden in TopHeader; that branch is applied automatically (and persisted).
- **Multiple branches:** Branch dropdown is shown; user can choose a branch or "All Branches". Selection is persisted and synced to `SupabaseContext.branchId`.

---

## 6. Module Integration

Modules that use the global filter and set `currentModule`:

- **Dashboard** — `setCurrentModule('dashboard')`, uses `startDate` / `endDate` for metrics and charts.
- **Sales** — `setCurrentModule('sales')`, filters list by global date and context `branchId`.
- **Purchases** — `setCurrentModule('purchases')`, same.
- **Rentals** — `setCurrentModule('rentals')`.
- **Accounting** — `setCurrentModule('accounting')`; AccountingContext uses `startDate` / `endDate` from global filter.
- **Reports (legacy)** — `setCurrentModule('reports')`, filters by global date.
- **Reports (Enhanced)** — `setCurrentModule('reports')`, uses global `startDate` / `endDate`; no local date dropdown.

Other modules (Inventory, Studio, Expenses) can be wired the same way: call `setCurrentModule(...)` on mount and use `startDate`, `endDate`, `branchId` from `useGlobalFilter()`.

---

## 7. Performance

- **Re-fetch:** When `dateRangeType`, `customStartDate`, `customEndDate`, or `branchId` change, components that depend on them (e.g. via `useEffect([startDate, endDate, branchId], ...)`) will re-run and reload data. No full page reload except on branch change (TopHeader currently reloads on branch switch).
- **Persistence:** Only on change; one write to `localStorage` per update.
- **No schema/RLS:** Filter engine is front-end and context only; no DB or RLS changes.

---

## 8. Files

| File | Role |
|------|------|
| `src/app/context/GlobalFilterContext.tsx` | Context, persistence, date math, branch sync. |
| `src/app/components/layout/TopHeader.tsx` | Date + branch UI; reads/writes global filter. |
| `src/app/App.tsx` | Wraps app with `GlobalFilterProvider` (replaces `DateRangeProvider`). |

`DateRangeContext` is no longer used; all consumers were migrated to `useGlobalFilter()`.

---

## 9. Future Extensions (Optional)

The same pattern can be extended to:

- **User filter** — e.g. `userId` in context for "current user" or "all users".
- **Status / Customer / etc.** — extra keys in persisted state and context, with TopHeader or a shared filter bar controlling them.

This turns the global filter into a small **ERP intelligence layer** (Odoo/SAP-style) without changing accounting or DB logic.
