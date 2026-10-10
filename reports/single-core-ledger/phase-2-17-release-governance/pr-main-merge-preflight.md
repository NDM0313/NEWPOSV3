# Phase 2.17X — PR / Main Merge Preflight Cleanup

**Date:** 2026-06-27  
**Scope:** Docs/governance only — OLD ERP / DIN Collection ERP (not FX app)

---

## Repository verification

| Check | Result |
|-------|--------|
| Branch | `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` |
| Phase 2.17 commit in history | **YES** — `41dd467a` |
| Phase 2.17X scope | Docs cleanup + preflight evidence only |
| FX / multi-currency app touched | **NO** |

---

## Current phase

**2.17X — PR/Main Merge Preflight Cleanup**

Prior accepted status:

- Phase 2.16 = **A** — `PHASE 2.16 MONITORING PASS — DIN CHINA UNIFIED LEDGER STABLE`
- Phase 2.17 = **COMPLETE** — release governance @ `41dd467a`

---

## Stale wording found (before cleanup)

In `docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md`:

| Location | Stale text | Problem |
|----------|------------|---------|
| Executive summary | Phase 2.9A-2 **BLOCKED on prod** | Implied rollout still blocked; preview deploy completed in 2.9A-3 |
| Executive summary | Phase 2.9A-4 **Ledger V2 interactive session pending** | Superseded by Stage 1/2 pilot QA |
| Phase 2 timeline | Preview wiring **BLOCKED until plan approved** | Wiring shipped in 2.1–2.7; loaders live |
| “What is blocked” section | `unified_ledger_engine` ON **Blocked** | Contradicts live DIN CHINA engine ON |
| “What is blocked” section | Phase 2 UI wiring **Blocked** | Contradicts complete rollout |
| “What is blocked” section | Merge PR / deploy as generic ops block | Misread as accounting rollout blocker |
| Accelerated soak (historical) | Stage 2 SQL **NOT RUN** | Contradicts Stage 2 execution @ 2026-06-25 |

---

## Wording cleaned / clarified

1. Added executive-summary banner: historical timeline vs live authoritative top section.
2. Marked 2.9A-2 / 2.9A-4 rows as **COMPLETE (historical)** with supersession notes.
3. Renamed **“What is blocked”** → **“What remains blocked / optional next phases”** with current truth:
   - DIN CHINA rollout **complete**
   - Phase 2.17 governance **complete**
   - PR/merge = **operator action only**
   - Other-company expansion **blocked** until finance sign-off
   - Optional 2.18 / 2.19 / roznamcha_payment called out
4. Phase 2 section marked **complete (historical)**; removed BLOCKED on 2.1+.
5. Fixed accelerated soak Stage 2 SQL row to **RUN** with historical context note.
6. Updated top status and final status to **Phase 2.17X PR/MAIN MERGE PREFLIGHT READY**.

---

## Confirmations

| Constraint | Honored |
|------------|---------|
| Accounting / source / runtime logic changed | **NO** |
| Flags changed | **NO** |
| Migrations run | **NO** |
| GL mutations | **NO** |
| Other-company expansion | **NO** |
| FX app touched | **NO** |

---

## Verification gates (Phase 2.17X)

| Gate | Result |
|------|--------|
| `npm run test:unified-ledger` | **PASS** — 240/240 |
| `npm run build` | **Not re-run** — docs-only; Phase 2.17 build already PASS; no source files changed |

---

## PR / main merge readiness

**Status: PR_MAIN_MERGE_PREFLIGHT_READY**

DIN CHINA Single Core Ledger rollout is **complete and stable**. Main merge is governance hygiene only.

### Operator action required

1. **Create PR** if none exists for this branch (do not auto-merge).
2. **Review PR** — confirm no flag SQL, migrations, or GL changes in diff scope.
3. **Approve merge** explicitly when satisfied.

```bash
gh pr create \
  --base main \
  --head feature/single-core-ledger-phase-2-9a3-preview-deploy-plan \
  --title "accounting: finalize DIN CHINA single core ledger rollout governance" \
  --body "$(cat <<'EOF'
## Summary
- Phase 2.16 **PASS** — DIN CHINA unified ledger stable on https://erp.dincouture.pk
- Five unified main loaders live; golden values unchanged
- Phase 2.17 + 2.17X: governance/docs only — no flags, migrations, or GL mutations
- `npm run test:unified-ledger` 240 PASS; build PASS @ Phase 2.17

## Operator
- Review and approve merge — do **not** auto-merge
- Other-company expansion blocked until separate finance sign-off
EOF
)"
```

If `gh` is unavailable, open PR manually on GitHub from `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` → `main`.

---

## Optional future phases (not started)

| Phase | Description |
|-------|-------------|
| 2.18 | Admin Compare Cash/Bank raw RPC diagnostic cleanup |
| 2.19 | Other-company expansion planning (separate finance sign-off) |
| Future | `roznamcha_payment` RPC mode — separate migration approval |

---

## Companion manifest

[`pr-main-merge-preflight.json`](pr-main-merge-preflight.json)
