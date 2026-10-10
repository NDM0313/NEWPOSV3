# Phase 2.18 — Manual PR operator instructions

**Date:** 2026-06-27  
**Rollout branch:** `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan`  
**Target base:** `main`  
**Latest rollout commit:** `181a0d80` (pushed 2026-06-27)

---

## PR status

| Item | Value |
|------|-------|
| Open PR → `main` | **None** (verified 2026-06-27T13:45:43Z) |
| Consolidated closure | [`final-main-merge-closure-report.md`](final-main-merge-closure-report.md) |
| Stale PR #20 | https://github.com/NDM0313/NEWPOSV3/pull/20 — **do not use** (base is not `main`) |
| GitHub CLI | Not available in automation environment |

---

## Step 1 — Create PR

**Compare URL:**

https://github.com/NDM0313/NEWPOSV3/compare/main...feature/single-core-ledger-phase-2-9a3-preview-deploy-plan

1. Open the compare URL above.
2. Click **Create pull request**.
3. Set **base** = `main`, **compare** = `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan`.

**Title:**

```text
accounting: finalize DIN CHINA single core ledger rollout governance
```

**Body:** Copy entire contents of:

`reports/single-core-ledger/phase-2-17-release-governance/pr-body-final.md`

---

## Step 2 — Review (before merge)

- [ ] Read [`final-pr-ready-review.md`](final-pr-ready-review.md)
- [ ] Read [`final-pr-diff-review.md`](final-pr-diff-review.md)
- [ ] Confirm [`final-gates.md`](final-gates.md) — tests 240/240, build PASS
- [ ] Confirm **no SQL will run** as part of merge
- [ ] Confirm Phase 2.16 production evidence still authoritative

---

## Step 3 — Merge (operator approval required)

- **Do not auto-merge** without explicit approval
- Use normal merge commit (or repo default strategy)
- **Do not** run flag-enable SQL after merge
- **Do not** enable other company loaders

**gh CLI (if installed locally):**

```bash
gh pr create \
  --base main \
  --head feature/single-core-ledger-phase-2-9a3-preview-deploy-plan \
  --title "accounting: finalize DIN CHINA single core ledger rollout governance" \
  --body-file reports/single-core-ledger/phase-2-17-release-governance/pr-body-final.md

# After review and explicit approval:
gh pr merge <PR_NUMBER> --merge
```

---

## Step 4 — Post-merge (optional)

After merge to `main`:

1. `git checkout main && git pull origin main`
2. `npm run test:unified-ledger && npm run build`
3. Optionally re-run production monitoring (read-only):
   ```powershell
   $env:QA_BROWSER_PASSWORD = '<admin password>'
   node scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs
   ```
4. Update closure docs or run Phase 2.18 post-merge verify pack

---

## Important

**DIN CHINA rollout is already complete and stable on production.** Merging to `main` is **code/governance integration only** — not a new accounting rollout.
