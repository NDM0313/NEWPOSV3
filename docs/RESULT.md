# RESULT — Accounting Integrity Test Lab

See the full deliverable: **[ACCOUNTING_INTEGRITY_LAB_RESULT.md](./ACCOUNTING_INTEGRITY_LAB_RESULT.md)** (includes Phase 2 + **blocker fixes**: purchase status filter 400, lazy default exports, snapshot truth on API failure).

## Git commit hash

The tooling-blocker fix is on branch `main` with message:

`fix(integrity-lab): purchase status filter 400, snapshot truth, lazy default export`

Resolve the exact SHA after pull:

```bash
git log -1 --oneline --grep="integrity-lab"
git rev-parse HEAD
```
