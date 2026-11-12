# Repair Action Registry

Central contract for Developer Center controlled repairs (Phase F).

---

## Type contract

```ts
type DeveloperRepairAction = {
  id: string;
  title: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiredRole: 'developer' | 'super-admin';
  confirmPhrase: string | ((params) => string);
  whatItChanges: string[];
  whatItNeverChanges: string[];
  dryRun: (params, ctx) => Promise<DryRunResult>;
  apply: (params, ctx, dryRunHash) => Promise<ApplyResult>;
  auditPayload: (before, after) => object;
  rollbackNote: string;
};
```

Implementation: [`src/app/lib/developerRepairActions.ts`](../../../src/app/lib/developerRepairActions.ts) and [`src/app/lib/developerRepairActions/`](../../../src/app/lib/developerRepairActions/).

---

## Dry-run hash rules

1. `computeDryRunHash(actionId, params, before)` — stable JSON (sorted keys) + FNV-1a.
2. `dryRun()` must never mutate data.
3. `apply()` re-runs `dryRun()` and refuses if hash mismatch or eligibility changed.
4. UI disables Apply until dry-run succeeds and confirm phrase matches exactly.

---

## Orchestrator

[`developerRepairService.ts`](../../../src/app/services/developerRepairService.ts):

- `runDeveloperRepairDryRun(actionId, params, ctx)`
- `applyDeveloperRepair(actionId, params, dryRunHash, confirmPhrase, ctx)`

Apply sequence: role gate → company scope → dry-run + hash → confirm phrase → mutation → audit row (success or failure).

---

## Why no SQL editor

Ad-hoc SQL bypasses detect/dry-run/audit, enables mass updates, and cannot enforce “never change GL amounts” per action. Each repair is a small registered function with explicit allow/deny lists.
