# UI Layer Replacement – STEP 1 (Layout) – Execution Result

**Date:** February 2026  
**Scope:** Layout UI only. Restricted files not touched.

---

## Files modified

| File | Change |
|------|--------|
| `src/app/components/layout/Layout.tsx` | Aligned JSX/styling with Figma: same structure (Sidebar + TopHeader + main + BottomNav); outer div uses Figma’s class list (removed `overflow-x-hidden`); inner content area uses Figma’s `flex-1 flex flex-col min-w-0`; main uses `flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6` (no `overflow-x-auto` / `max-w-full`). Added short comment that layout is Figma mobile UI structure. |
| `src/app/components/layout/BranchSelector.tsx` | UI-only: in both header and inline variants, `SelectItem` now shows branch code when present (Figma-style: `b.code` as small gray text next to name). All logic unchanged: `useSupabase`, `branchService`, loading, disabled, `isAdmin`. |

**Not modified (by design):**

- **Sidebar.tsx** – Kept as-is. Uses `useSettings()`, `useCheckPermission()`, `useNavigation()`, `useModules()`, module toggles (rental, POS, studio), permission-based hiding (reports, accounting, settings, users), Test Pages group, studio-pipeline. Figma version lacks these; replacing would break permissions and module toggles.
- **TopHeader.tsx** – Kept as-is. Uses `useSupabase()`, `useFormatCurrency()`, `useSales()`, `usePurchases()`, `useExpenses()`, `useDateRange()`, `branchService`, real notifications, profile modal, change password, custom date range. Figma version is mock-only; replacing would break behavior.
- **BottomNav.tsx** – Unchanged. Same as Figma (structure and behavior).
- **GlobalDrawer.tsx** – Kept as-is. Uses `useSupabase()`, `useNavigation()`, drawerData, parentDrawer, packing modal, contact/ledger services, edit-sale/edit-purchase. Figma version is minimal; replacing would break drawer behavior.

---

## Dependencies added

**None.** No package.json or new UI library changes.

---

## Conflicts encountered

| Conflict | Resolution |
|----------|------------|
| Figma Sidebar uses `useModules()` with `modules.rentals?.isEnabled` etc. | Kept existing Sidebar: it uses `useSettings().modules` (rentalModuleEnabled, posModuleEnabled, studioModuleEnabled) and `useCheckPermission()` for reports/accounting/settings. No replacement with Figma file. |
| Figma TopHeader has no Supabase, no real branches, no formatCurrency, no notifications. | Kept existing TopHeader. No replacement with Figma file. |
| Figma GlobalDrawer has no useSupabase, no drawerData/parentDrawer, no packing modal. | Kept existing GlobalDrawer. No replacement with Figma file. |

---

## Restricted files – confirmation

| Restricted item | Status |
|-----------------|--------|
| App.tsx | Not modified |
| main.tsx | Not modified |
| SupabaseContext | Not modified |
| SettingsContext | Not modified |
| vite.config.ts | Not modified |
| package.json | Not modified |
| PWA (manifest.json, sw.js, public/icons) | Not modified |
| Service worker registration | Not modified |
| Versioning (__APP_VERSION__, __BUILD_TIMESTAMP__) | Not modified |
| Routing root / React root | Not modified |

---

## Validation

- **Dev server:** `npm run dev:no-migrate` – started successfully (Vite ready, no compile errors).
- **Layout:** Same composition; Figma-aligned wrapper/main classes only.
- **Sidebar / BottomNav / TopHeader / GlobalDrawer / BranchSelector:** All existing behavior preserved (useSettings, useSupabase, useFormatCurrency, setCurrentView, openDrawer, permissions, module toggles, branch switching, currency display).

**Manual checks recommended:** In the browser, confirm sidebar navigation, BottomNav view switch, GlobalDrawer open, branch selector, currency in header notifications, and that restricted modules stay hidden by permission.
