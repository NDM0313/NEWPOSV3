# SAFE STABLE MODE – Locked

**Date:** 2026-02-16  
**Status:** Locked. No merge. No destructive operations. No deployment mixing.

---

## Confirmation

| Check | Status |
|-------|--------|
| **STEP 1 – Safe state** | ✅ On `main`, pulled from `origin main`, branch up to date |
| | ✅ Safety tag `pre-integration-safe-point` exists |
| **STEP 2 – Archive protection** | ✅ Branch renamed: `before-mobile-replace` → `archive-vps-mobile-2026` |
| | ✅ Pushed: `origin/archive-vps-mobile-2026` |
| | ✅ Old remote ref deleted: `origin/before-mobile-replace` |
| **Branch structure** | ✅ Clean: `main` (working), `archive-vps-mobile-2026` (archive only) |
| **main** | ✅ Protected as sole working branch |

---

## STRICT RULES (Locked)

1. **main** is the official working branch.
2. **No merge** from `archive-vps-mobile-2026`.
3. **No structural overwrite.**
4. **No destructive operations** on branches.
5. **No deployment model mixing.**

---

## STEP 3 – Development Workflow

All development happens **only on main**.

**Before starting work:**
```bash
git checkout main
git pull origin main
```

**After finishing work:**
```bash
git add .
git commit -m "Clear descriptive message"
git push origin main
```

---

## STEP 4 – Deployment Rule

**VPS must always deploy from main only.**  
No archive branch deployment.

---

## STEP 5 – Future Integration Policy

If any file is needed from the archive branch:

**Use selective checkout only:**
```bash
git checkout archive-vps-mobile-2026 -- path/to/file
```

**Never full merge.**

---

## Summary

- **Branch structure:** Clean. `main` = working; `archive-vps-mobile-2026` = archive.
- **Archive branch:** Safe. Renamed, pushed, old remote ref removed. Not deleted.
- **main:** Protected as the single source of truth.
- **Workflow:** Locked to main-only development and main-only VPS deploy.

No additional action. No merge. No risky change.
