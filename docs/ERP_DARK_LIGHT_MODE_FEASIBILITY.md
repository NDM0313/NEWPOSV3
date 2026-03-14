# ERP Dark / Light Mode Feasibility

**Date:** 2026-03-14  
**Scope:** Assessment only. No partial implementation.

---

## Requirement

Implement full dark/light mode only if it can be done properly end-to-end (toggle in top bar, A-to-Z consistency, no mixed broken screens). Otherwise document why it is deferred.

---

## Decision: **Deferred**

Full theme switching is **not** implemented in this pass.

---

## Reasons

1. **Current state**
   - The app is built as a dark-first ERP: backgrounds (`#0B0F19`, `bg-gray-900`, `bg-gray-950`), borders (`border-gray-800`), and text (`text-white`, `text-gray-400`) are hard-coded across many components.
   - There is no theme context, no CSS variables for colors, and no existing light theme palette.

2. **Scope for a proper implementation**
   - Introduce a theme context (e.g. `dark` | `light`) and a top-bar toggle.
   - Define a small set of CSS variables (e.g. `--bg-page`, `--bg-card`, `--border`, `--text-primary`, `--text-muted`) and use them everywhere that currently uses hard-coded gray/white/black.
   - Audit and update: layout (sidebar, header), all list/table views, forms, dialogs, reports, accounting pages, and print styles (where light is required).
   - Test every major flow in both themes to avoid mixed or broken screens.

3. **Risk of partial implementation**
   - Adding a toggle or a few variables without a full pass would produce mixed black/white pages and worse UX. The requirement was to avoid partial theme hacks.

4. **Recommendation**
   - Do a dedicated, app-wide theme pass: design tokens, replace hard-coded colors, then add the toggle and test. Not in this targeted polish pass.

---

## Deliverable

Documentation only: this file. No code changes for dark/light mode.
