# Phase 2B — Batch 2 proof (dead frontend/mock module cleanup)

**Updated:** 2026-04-01  
**Scope:** Repo-only cleanup proof for unused mobile mock accounting module(s).  
**Constraints honored:** No DB changes, no destructive SQL, no dangerous prototype/root scripts executed.

---

## Target candidates (mobile)

Deleted candidates:

1. `erp-mobile-app/src/components/accounting/AccountingModule.tsx`
2. `erp-mobile-app/src/components/accounting/delete/AccountingModule.tsx`

Both candidates were mock-only UI and mock data modules (no production wiring).

---

## Proof: not part of shipped mobile runtime

## Repo evidence (exact commands + results)

Commands (ripgrep equivalents):

```bash
rg -n "\\bAccountingModule\\b" erp-mobile-app/src
rg -n "erp-mobile-app/src/components/accounting/AccountingModule\\.tsx|src/components/accounting/AccountingModule\\.tsx" .
rg -n "components/accounting/AccountingModule\\.tsx|AccountingModule\\.tsx" erp-mobile-app/src
rg -n "import\\s+\\{?\\s*AccountingModule\\b|from\\s+['\\\"].*AccountingModule" erp-mobile-app/src
rg -n "AccountsModule" erp-mobile-app/src/App.tsx
```

Results (captured 2026-04-01):

- `rg -n "\\bAccountingModule\\b" erp-mobile-app/src` → no matches (post-deletion)
- `rg -n "components/accounting/AccountingModule\\.tsx|AccountingModule\\.tsx" erp-mobile-app/src` → no matches
- `rg -n "import\\s+\\{?\\s*AccountingModule\\b|from\\s+['\\\"].*AccountingModule" erp-mobile-app/src` → no matches
- `rg -n "AccountsModule" erp-mobile-app/src/App.tsx` → import exists at [App.tsx:L30](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/erp-mobile-app/src/App.tsx#L30)
- `rg -n "erp-mobile-app/src/components/accounting/AccountingModule\\.tsx|src/components/accounting/AccountingModule\\.tsx" .` → matches are documentation/design references only (no runtime imports)

File existence (post-change):

- `glob **/erp-mobile-app/src/components/accounting/AccountingModule.tsx` → no file found

### Proof A — Mobile app entry does not import or reference AccountingModule

`erp-mobile-app/src/App.tsx` imports `AccountsModule` and does not import `AccountingModule`:

- [App.tsx:L21-L36](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/erp-mobile-app/src/App.tsx#L21-L36)

### Proof B — Search inside mobile runtime tree (pre-delete and post-delete)

Search pattern:

- `\bAccountingModule\b`

Pre-delete result (only self-reference):

- `erp-mobile-app/src/components/accounting/AccountingModule.tsx` (export declaration)

After deleting that file, a second copy was discovered:

- `erp-mobile-app/src/components/accounting/delete/AccountingModule.tsx`

That second copy had no inbound references:

- Search pattern: `components/accounting/delete/AccountingModule|accounting/delete|delete/AccountingModule`
- Result: no matches in `erp-mobile-app/src`

Post-delete result:

- `\bAccountingModule\b` → no matches in `erp-mobile-app/src`
- `**/AccountingModule.tsx` → no matches in `erp-mobile-app/src`

### Proof C — Repo-wide search shows references are documentation/design only

Search pattern:

- `components/accounting/AccountingModule|src/components/accounting/AccountingModule|AccountingModule.tsx`

Matches were limited to:

- Phase docs under `docs/accounting/`
- A design artifact under `Figma Mobile ERP App Design/`

No runtime code in `src/` or `erp-mobile-app/src/` imported these modules.

---

## Conclusion

- Classification: **SAFE_TO_REMOVE_BATCH2**
- Safe to remove/archive: **YES**
- Runtime references found: **0** (post-deletion verification); repo references are limited to documentation/design trees

---

## Action executed (Batch 2)

Deleted (repo-only):

- `erp-mobile-app/src/components/accounting/AccountingModule.tsx`
- `erp-mobile-app/src/components/accounting/delete/AccountingModule.tsx`

Kept (design tree; already separate from shipped app):

- `Figma Mobile ERP App Design/src/components/accounting/AccountingModule.tsx`

---

## Rollback

Rollback method:

- Restore deleted files from git history (revert commit / restore paths).

Data retention / audit impact:

- None (frontend-only mock UI).

---

## Build check (non-blocking note)

Attempted safe compile check:

- Command: `erp-mobile-app` → `npm run build` (`tsc -b && vite build`)

Result:

- Build failed due to pre-existing TypeScript errors in multiple unrelated files (no errors referenced the deleted AccountingModule paths).
