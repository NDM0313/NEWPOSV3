# Import FX W3 — MacBook Handoff (Windows office → home)

**Date:** 2026-08-13  
**From:** Windows office PC  
**To:** MacBook Pro  
**Branch:** `feat/import-fx-w3-advance-usd-demo`  
**Base:** `origin/main` (includes merged W2 / PR #23)

---

## 1. What was uploaded tonight

| Area | Status on branch |
|------|------------------|
| W3 additive migrations (advance + USD acquisition RPCs) | In repo — **not applied to production** |
| W3 UI panel + Settings clearing account picker | Present; capability-gated |
| Local UI Demo Mode (`/demo/import-fx-w3`) | Present; flag + localhost only |
| Design + master plan + impl QA docs | Present |
| Production journals / VPS migrate | **Not touched** |

**Demo ≠ live QA.** Simulation never creates journals or Supabase writes.

---

## 2. MacBook — start here

```bash
cd /path/to/NEWPOSV3   # your Mac clone
git fetch origin
git checkout feat/import-fx-w3-advance-usd-demo
git pull origin feat/import-fx-w3-advance-usd-demo
npm install
```

Open the Draft PR on GitHub (title should mention W3 + demo). Review there; **do not merge to `main` until owner sign-off.**

> Push to `main` triggers [`.github/workflows/deploy-vps.yml`](../../.github/workflows/deploy-vps.yml) auto-deploy (and may run migrations). Keep this as a Draft until ready.

---

## 3. Local Demo Mode (safe UX check — no Docker/DB)

1. In **gitignored** `.env.local` only:

```bash
VITE_IMPORT_FX_W3_DEMO=true
```

2. Do **not** change production `VITE_SUPABASE_URL` for demo.

3. Start:

```bash
npm run dev:w3-demo
```

4. Open:

`http://localhost:5173/demo/import-fx-w3`

Also: `http://127.0.0.1:5173/demo/import-fx-w3`

5. Verify badge: `DEMO — NOT POSTED` and header that nothing is financially posted.

6. Optional tests:

```bash
npm run test:import-fx-w3
node scripts/qa/import-fx-w3-demo-static-qa.mjs
```

---

## 4. Remaining work (MacBook / later)

### A. Non-production live W3 QA (required before prod)

1. Point a **localhost / non-prod** DB (not `supabase.dincouture.pk`).
2. Apply W2/W2.1 if needed, then W3 via local apply scripts (`.env.db.local`, host localhost only).
3. Settings → Multi Currency ON → set **Agent FX Advance / Settlement Clearing** account (never hardcode `1230`).
4. Open real Import FX case → Advance / USD Acquisition → Confirm & Post.
5. Inspect journals; reverse; confirm `PARTIALLY_POSTED` only.

Canonical QA: [`IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md`](./IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md)  
Design ODs: [`IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md`](./IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md)  
Roadmap: [`IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md`](./IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md)

### B. After Mac review

1. Mark Draft PR ready → merge to `main` only with owner approval.
2. Expect auto VPS deploy from GitHub Actions / deploy path — **frontend can ship while RPCs missing** (UI stays fail-closed).

### C. VPS later checklist (explicit — not done tonight)

Use SSH config host only:

```bash
ssh dincouture-vps
```

Typical later sequence (owner-approved):

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git fetch origin && git checkout main && git pull --ff-only origin main"
# Deploy app (only after merge approval):
ssh dincouture-vps "cd /root/NEWPOSV3 && BRANCH=main bash deploy/deploy.sh"
```

**Separate, explicit step — W3 money migrations on production:**

- Do **not** apply `20260813180000_*` / `20260813180100_*` until owner accepts blast radius (journals, wallets, Agent AP/clearing).
- Prefer non-prod prove-out first.
- When applying: use the project’s normal migration path on VPS; verify `import_fx_w3_capability` returns installed before any operator Confirm & Post.

### D. After W3 live QA passes

- W4 China USD transfer + USD→CNY conversion (master plan) — **not started**.
- W5–W6 remain future.

---

## 5. Safety reminders

| Rule | Tonight |
|------|---------|
| Production W3 RPC calls / fake journals | No |
| Demo Mode on production domain | Rejected by hostname gate |
| Path 21 Agent FX | Unchanged / separate |
| `fxSettlementAccountingEnabled` | Stays false (Profile A) |
| Graphify / `tmp/` noise | Not committed |

---

## 6. Key paths

- Migrations: `migrations/20260813180000_import_fx_case_w3_advance_usd_acquisition.sql`, `migrations/20260813180100_import_fx_case_w3_usd_acquisition_rpcs.sql`
- UI: `src/app/features/import-fx-case/ImportFxCaseW3MoneyPanel.tsx`, `ImportFxW3DemoPage.tsx`
- Service: `src/app/services/importFxCaseW3Service.ts`
- Demo gate/store: `src/app/lib/importFxW3DemoGate.ts`, `importFxW3DemoStore.ts`
- Scripts: `scripts/qa/apply-import-fx-w3-local.mjs`, `scripts/qa/import-fx-w3-demo-static-qa.mjs`

---

## 7. Office stop condition

Windows work stops after: branch pushed + Draft PR open + this handoff file on the branch.  
**No VPS migrate / no production W3 post from the office session.**
