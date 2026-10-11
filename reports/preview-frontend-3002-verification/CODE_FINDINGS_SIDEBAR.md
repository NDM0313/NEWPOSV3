# Sidebar collapse — code findings (verify-only)

**Scope:** 2A — document current in-memory 260↔80 icon rail. No persistence changes.

## Live path

1. [`Layout.tsx`](../../src/app/components/layout/Layout.tsx) mounts desktop `Sidebar`, `TopHeader`, `MobileNavDrawer`, `BottomNav`.
2. [`NavigationContext.tsx`](../../src/app/context/NavigationContext.tsx):
   - `isSidebarOpen` initialized with `useState(true)` (always expanded after full remount/refresh).
   - `toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), [])`.
3. [`Sidebar.tsx`](../../src/app/components/layout/Sidebar.tsx):
   - `motion.aside` width: `isSidebarOpen ? 260 : 80`.
   - Chevron button `onClick={toggleSidebar}`.
   - Collapsed parent navigation auto-expands before showing children.

## Not on live path

- [`ui/sidebar.tsx`](../../src/app/components/ui/sidebar.tsx): shadcn `SidebarProvider` writes cookie `sidebar_state` but is never imported by `Layout`. Ignore for QA unless wiring is added later (out of scope).

## Hydration / console

- Open state is React memory only → no localStorage read during render for collapse → no hydration mismatch from persisted sidebar width.
- `Sidebar` uses `typeof window !== 'undefined' ? window.location.pathname : ''` for some active-route highlighting (guarded).

## Browser expectations

| Action | Expected |
|--------|----------|
| Collapse chevron | Width ~80, labels hidden |
| Expand chevron | Width ~260, labels visible |
| Hard refresh | Expanded again |
| Toggle spam | No React hydration errors in console |

## Ledger smoke entry points (optional)

| URL | View |
|-----|------|
| `http://localhost:3002/?view=accounting` | Accounting dashboard / tabs |
| `http://localhost:3002/?view=party-ledger` | Effective party ledger |
