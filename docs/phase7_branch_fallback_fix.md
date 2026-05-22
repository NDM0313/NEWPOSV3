# Phase 7 — Mobile branch fallback (zero `user_branches`)

**Scope:** Client-side fallback when restricted users have no explicit `user_branches` rows. No migrations, auth bridge, or counter PIN changes.

Related: [`phase7_branch_selection_fix.md`](phase7_branch_selection_fix.md), [`system-lockdown-safety.mdc`](../.cursor/rules/system-lockdown-safety.mdc).

---

## Regression

After the branch-selection filter fix, restricted users with **empty** `user_branches` saw "No branch assigned" and **0 branches** instead of entering the app.

**Required:** Fallback to company default branch (prefer name **Main Branch**, else first loaded branch), then auto-route to **home**—same intent as DB [`get_company_default_branch_id`](../../migrations/auto_assign_default_branch_for_non_admin.sql).

---

## Rules

| Case | Behavior |
|------|----------|
| Restricted, 0 `user_branches`, company has branches | `effectiveBranchIds = [defaultBranchId]` → auto home |
| Restricted, 1+ explicit assignments | Filter list to assigned only (unchanged) |
| Admin/owner | All company branches + "All Branches" (unchanged) |
| Company has 0 branches | No fallback id; empty / add-branch UI only |

---

## Files to touch

| File | Change |
|------|--------|
| `docs/phase7_branch_fallback_fix.md` | This audit |
| `erp-mobile-app/src/lib/branchResolution.ts` | **New** — `pickCompanyDefaultBranch`, `resolveEffectiveBranchIds` |
| `erp-mobile-app/src/components/BranchSelection.tsx` | Use effective ids; remove zero-assignment block when default exists |
| `erp-mobile-app/src/App.tsx` | Bootstrap/login paths use effective ids + auto-home |
| `erp-mobile-app/src/context/PermissionContext.tsx` | `hasBranchAccess` fallback for multi-branch companies |
| `docs/audit_log_latest.md` | Cross-reference |

**Not touched:** `SupabaseContext`, auth bridge, `counterUserVault`, migrations, `getUserBranchIds` SQL.

---

## Test matrix

| Scenario | Expected |
|----------|----------|
| salesman, 0 assignments, Main + Saddar exist | Auto home on default; no error banner |
| salesman, 1 assignment | Auto home |
| salesman, 2+ assignments | Picker: assigned branches only |
| admin/owner | All branches + All Branches |
| company 0 branches | No fallback; add-branch / empty state |

---

## Implementation status

**Completed 2026-05-21.**

| File | Done |
|------|------|
| `erp-mobile-app/src/lib/branchResolution.ts` | `pickCompanyDefaultBranch`, `resolveEffectiveBranchIds`, `resolveBranchForSingleEffectiveId` |
| `erp-mobile-app/src/components/BranchSelection.tsx` | Filter by `effectiveBranchIds`; `noCompanyBranches` only when company has 0 branches |
| `erp-mobile-app/src/App.tsx` | `applyProfileAfterCounterSwitch`, auth bootstrap, `handleLogin` — effective ids + auto-home |
| `erp-mobile-app/src/context/PermissionContext.tsx` | Default branch fallback when `branchIds` empty (multi-branch companies) |

`npm run typecheck` in `erp-mobile-app` — pass.
