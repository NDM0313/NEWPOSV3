# Sidebar collapse — code findings (updated)

**Status:** Persistence + breakpoint fix implemented (2026-10-11).

## Root cause of inconsistent behavior

1. **No persistence** — `isSidebarOpen` was session-only `useState(true)`, so refresh/nav remount always re-expanded.
2. **Breakpoint mismatch** — desktop `Sidebar` is `hidden md:flex` and `BottomNav` is `md:hidden`, but header hamburger was `lg:hidden`, so between `md` and `lg` both rails competed and `toggleSidebar` was unused in `TopHeader`.

## Live path (current)

| Piece | Behavior |
|-------|----------|
| [`sidebarOpenPreference.ts`](../../src/app/lib/sidebarOpenPreference.ts) | Key `erp_sidebar_open` (`1`/`0`) via `safeLocalStorage*` |
| [`NavigationContext.tsx`](../../src/app/context/NavigationContext.tsx) | Default `true`; hydrate after mount; persist after hydrate |
| [`Sidebar.tsx`](../../src/app/components/layout/Sidebar.tsx) | Framer width **260 ↔ 80**; chevron + `aria-*` |
| [`TopHeader.tsx`](../../src/app/components/layout/TopHeader.tsx) | Mobile menu `md:hidden`; desktop Menu toggle `hidden md:inline-flex` → `toggleSidebar` |

## Hydration

Initial render always expanded; client `useEffect` applies stored collapse. Avoids SSR/CSR mismatch. First paint may briefly show expanded if preference was collapsed (acceptable).

## Browser expectations (after preview rebuild)

| Action | Expected |
|--------|----------|
| Header Menu (desktop) or chevron | Toggle 260 ↔ 80 |
| Hard refresh | Restores last state from `localStorage` |
| Console | No hydration errors from sidebar pref |
