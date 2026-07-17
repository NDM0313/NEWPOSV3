# ROLLBACK.md

## Code

1. Feature branch only — do not merge to `main` until reviewed.
2. Revert feature commits or delete worktree branch; redeploy prior mobile build via existing Capacitor/VPS scripts.
3. Dirty main WIP remains intact in original tree — do not `reset --hard` / `clean -fd` without explicit approval.

## Flags (no DB rollback required)

- Turn off party_ledger / roznamcha loader or screen flags, or activate unified kill switch → legacy paths.
- No migrations applied in this phase → **no SQL rollback**.

## Do not

- Force-push `main`
- Reclassify 4100
- Delete R8-R2 / legacy loaders as rollback
