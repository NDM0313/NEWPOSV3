# Phase 7 — Mobile branch selection fix

**Scope:** [`erp-mobile-app`](../../erp-mobile-app/) UI + bootstrap only. No migrations, GL, auth bridge, or counter PIN vault changes.

Related: [`system-lockdown-safety.mdc`](../.cursor/rules/system-lockdown-safety.mdc), [`audit_log_latest.md`](audit_log_latest.md).

---

## Problem

Restricted users (e.g. **salesman**) on the Branch Selection screen saw **all company branches** when they had **zero** `user_branches` rows, while the error banner said "No branch assigned."

**Root cause:** [`BranchSelection.tsx`](../erp-mobile-app/src/components/BranchSelection.tsx) only filtered `branches` when `userBranchIds.length > 0`. Empty assignment left the full company list visible. `noBranchAssigned` required `branches.length > 1`, so some zero-assignment cases still showed cards.

**Secondary:** [`App.tsx`](../erp-mobile-app/src/App.tsx) restored a saved branch from `localStorage` when `userBranchIds.length === 0` for non-admins, bypassing assignment checks.

---

## Rules implemented

| Rule | Implementation |
|------|----------------|
| **Admin/owner unrestricted** | `canPickAllCompanyBranches(role)` — `admin` or `owner` see all company branches + "All Branches" pseudo-option |
| **Restricted filter** | All other roles: list = `branches.filter(id ∈ userBranchIds)`; if `userBranchIds` empty → list `[]` |
| **Zero assignments** | `noBranchAssigned` when restricted + `userBranchIds.length === 0`; **no branch list** rendered |
| **Exactly one assignment** | Auto `onBranchSelect` → `App` routes to **home** (existing `handleBranchSelect`) |
| **Locked branch** | Unchanged — `branchLocked` + single branch still auto-selects |

---

## Files touched

| File | Change |
|------|--------|
| `docs/phase7_branch_selection_fix.md` | This audit (created before code) |
| `erp-mobile-app/src/api/permissions.ts` | `canPickAllCompanyBranches()` |
| `erp-mobile-app/src/components/BranchSelection.tsx` | Filter, banner, hide list, auto-bypass |
| `erp-mobile-app/src/App.tsx` | Saved-branch restore guards + role helper in bootstrap/login flows |
| `docs/audit_log_latest.md` | Cross-reference entry |

**Not touched:** `SupabaseContext`, `counterUserVault`, `auth.ts` bridge, migrations, `getUserBranchIds` SQL shape.

---

## Test matrix (manual)

| Role | `user_branches` count | Expected |
|------|----------------------|----------|
| salesman | 0 | Error banner only; **no** branch buttons |
| salesman | 1 | Skip picker → home |
| salesman | 2+ | Picker shows assigned branches only |
| admin / owner | any (company has branches) | All branches + "All Branches" |

---

## Implementation status

**Completed 2026-05-21.**

- `canPickAllCompanyBranches()` added in [`permissions.ts`](../erp-mobile-app/src/api/permissions.ts).
- [`BranchSelection.tsx`](../erp-mobile-app/src/components/BranchSelection.tsx): restricted users get empty list when unassigned; banner without cards; single assigned branch auto-selects (skips `all` pseudo-id).
- [`App.tsx`](../erp-mobile-app/src/App.tsx): three bootstrap/login paths use `unrestricted` + `mayRestoreSavedBranch` (removed `userBranchIds.length === 0` bypass for restricted roles).
- `npm run typecheck` in `erp-mobile-app`: **pass**.
