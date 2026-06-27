# Phase 2.17Y — PR Creation, Review, and Main Merge Governance

**Date:** 2026-06-27  
**Scope:** Governance only — OLD ERP / DIN Collection ERP (not FX app)

---

## Repository verification

| Check | Result |
|-------|--------|
| Branch | `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` |
| Phase 2.17X commit in history | **YES** — `d3d3173c` (HEAD before Phase 2.17Y doc commit) |
| Base branch (target) | `main` |
| Local working tree | **Dirty** — unrelated local modifications present; Phase 2.17Y commit scoped to governance docs only |
| FX / multi-currency app in diff | **None** |
| Required prior docs | **Present** |

---

## PR status

| Item | Value |
|------|-------|
| PR to `main` | **Does not exist** |
| Existing PR #20 | https://github.com/NDM0313/NEWPOSV3/pull/20 — **draft**, base = `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` (not `main`), stale title |
| Action | **Operator must create new PR** `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` → `main` OR retarget/update #20 |
| GitHub CLI | **Not available** in execution environment |
| PR body prepared | [`pr-body-final.md`](pr-body-final.md) |

### Manual PR creation

**Title:** `accounting: finalize DIN CHINA single core ledger rollout governance`

**Steps:**

1. Open https://github.com/NDM0313/NEWPOSV3/compare/main...feature/single-core-ledger-phase-2-9a3-preview-deploy-plan
2. Click **Create pull request**
3. Paste body from [`pr-body-final.md`](pr-body-final.md)
4. **Do not auto-merge** — wait for operator review and approval

**Alternative (gh CLI on operator machine):**

```bash
gh pr create \
  --base main \
  --head feature/single-core-ledger-phase-2-9a3-preview-deploy-plan \
  --title "accounting: finalize DIN CHINA single core ledger rollout governance" \
  --body-file reports/single-core-ledger/phase-2-17-release-governance/pr-body-final.md
```

---

## Diff summary (`origin/main...HEAD`)

**Totals:** 590 files changed, ~73,368 insertions, ~3,973 deletions

| Category | Files | Notes |
|----------|------:|-------|
| Accounting source/runtime (`src/`) | 155 | Unified ledger loaders, preview, compare, services — rollout Phases 2.1–2.15 |
| Scripts (`scripts/`) | 126 | QA automation, rollback/enable SQL **artifacts** (already applied in prod for DIN CHINA) |
| Reports / evidence (`reports/`) | 260 | Phase evidence packs |
| Docs (`docs/`) | 39 | Plans, production ready, checklists |
| Migrations (`migrations/`) | 4 | Documented Phase 1.5 unified RPC migrations (already on production) |
| Deploy | 1 | Preview compose |
| Repo config | 3 | `.gitignore`, `package.json`, `graphify-out/GRAPH_REPORT.md` |
| FX / multi-currency app | **0** | None |

### Migrations in diff (documented earlier phases)

- `migrations/20260620140000_get_unified_party_ledger_shadow.sql`
- `migrations/20260621120000_single_core_ledger_systemwide_diagnostics.sql`
- `migrations/20260621150000_unified_ledger_phase_15_rpcs.sql`
- `migrations/20260621151000_unified_ledger_phase_15_indexes.sql`

**Assessment:** No new undocumented migration apply introduced in Phase 2.17Y. Merge integrates existing rollout branch; does **not** execute SQL.

### Enable/rollback SQL in diff

Present under `scripts/single-core-ledger/phase-21x-*` — documented rollout runbooks from Phases 2.10–2.15. Flags already enabled in production; merge is code integration only.

---

## Verification gates

| Gate | Result |
|------|--------|
| `npm run test:unified-ledger` | **PASS** — 240/240 |
| `npm run build` | **PASS** |

---

## Phase 2.17Y confirmations

| Constraint | Honored |
|------------|---------|
| Flags changed in Phase 2.17Y | **NO** |
| Migrations run in Phase 2.17Y | **NO** |
| GL mutations in Phase 2.17Y | **NO** |
| Other-company expansion | **NO** |
| FX app touched | **NO** |
| Accounting/source logic changed in Phase 2.17Y | **NO** — docs only |

---

## Operator merge checklist

1. **Review PR files changed** — use category table above; confirm scope matches Single Core Ledger rollout
2. **Confirm no production flag SQL will be executed** as part of merge/deploy workflow
3. **Confirm tests/build pass** — 240/240 + build PASS @ Phase 2.17Y
4. **Confirm DIN CHINA production truth** — Phase 2.16 evidence authoritative; golden values unchanged
5. **Approve merge manually** — do not auto-merge
6. **After merge:** do **not** enable other company unified loaders without separate finance sign-off

---

## Production truth (unchanged)

DIN CHINA rollout **complete and stable**. Five unified main loaders live. Main merge is **governance / code integration only** — not a new accounting rollout.

---

## Optional future phases (not started)

| Phase | Description |
|-------|-------------|
| 2.18 | Admin Compare Cash/Bank raw RPC diagnostic cleanup |
| 2.19 | Other-company expansion planning (separate finance sign-off) |
| Future | `roznamcha_payment` RPC mode — separate migration approval |

---

## Companion artifacts

- PR body: [`pr-body-final.md`](pr-body-final.md)
- Phase 2.17 manifest: [`release-manifest.json`](release-manifest.json)
- Phase 2.17X preflight: [`pr-main-merge-preflight.json`](pr-main-merge-preflight.json)
