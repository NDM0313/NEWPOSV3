# Import FX Case — Guided UA shell

**Status:** Shipped (UI composition only)  
**Scope:** Live [`ImportFxCaseWorkspace`](../../src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx) — not a second product, not Path 21.  
**View-model:** [`importFxCaseWorkspaceView.ts`](../../src/app/lib/importFxCaseWorkspaceView.ts)

## Why

The W2 workspace mixed case list, 8-stage timeline, Path 21 education, arrangement sections 1–5, W3 money, assignment, and audit on one scroll. Operators could not tell what was the current task.

## Target chrome

```
Slim header: case · ops status · accounting status · optional Path help
Progress: Arrange → Advance → Buy USD → Later
Main: one task title + why + form for this step only
Footer: Cases drawer · Context drawer · New draft
```

## Operator flow

1. **Arrange** — five guided sub-steps (Parties → Funding → Currency → Schedule/refs → Review). Confirm Arrangement only on Review.
2. **Advance** — W3 money panel only (optional before USD).
3. **Buy USD** — W3 USD acquisition panel only.
4. **Later** — W4+ blocked notice until those waves ship.

Cases list and summary/assignment/audit live in drawers so they do not compete with the active task.

## Contracts unchanged

- No new migrations / RPCs.
- Arrangement still `posts_journal: false`.
- Path 21 Agent FX remains a separate screen.
- W3 Demo route remains local/secondary (`ImportFxW3DemoEntryLink`).

## Related design SoT

- [`IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md`](IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md) — staged case workspace
- [`IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md`](IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md) — money waves
