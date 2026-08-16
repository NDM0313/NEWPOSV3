# Import FX Case — W3 Implementation and QA

**Status:** **LOCALHOST LIVE APPLY + RPC QA PASS (2026-08-14)** · production migrate/deploy still deferred · Draft PR #24 not merged  
**Date:** 2026-08-14  
**Live DB:** Applied on `localhost:5432/postgres` (`newposv3-local-pg`) only. See [`IMPORT_FX_W3_FINAL_FINISH_LOCALHOST_2026-08-14.md`](./IMPORT_FX_W3_FINAL_FINISH_LOCALHOST_2026-08-14.md).

**Canonical design:** [`IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md`](./IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md) (OD-1–OD-7 **unchanged / locked**)  
**Master plan:** [`IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md`](./IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md)

---

## 1. Schema / migrations

| File | Role |
|------|------|
| [`migrations/20260813180000_import_fx_case_w3_advance_usd_acquisition.sql`](../../migrations/20260813180000_import_fx_case_w3_advance_usd_acquisition.sql) | Tables, helpers, capability probe, money overview, `post_import_fx_agent_advance` |
| [`migrations/20260813180100_import_fx_case_w3_usd_acquisition_rpcs.sql`](../../migrations/20260813180100_import_fx_case_w3_usd_acquisition_rpcs.sql) | `post_import_fx_usd_acquisition`, reverse advance, reverse USD |

**Tables:** `import_fx_case_advances`, `import_fx_case_usd_acquisitions`, `import_fx_case_advance_applications`, `import_fx_case_usd_lots`  
**RLS:** SELECT company-scoped; writes RPC-only.

**Local apply (localhost only):** `node scripts/qa/apply-import-fx-w3-local.mjs` (requires `.env.db.local`, host localhost/127.0.0.1).

---

## 2. Settings key

- JSON: `accounting_settings.agentFxAdvanceClearingAccountId`
- Role: `AGENT_FX_ADVANCE_CLEARING` (display: Agent FX Advance / Settlement Clearing)
- **Never hardcode `1230`**
- Missing/invalid → post advance returns `IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED`
- UI: Settings → Accounting (when Multi Currency ON)

---

## 3. RPCs

| RPC | posts_journal |
|-----|---------------|
| `import_fx_w3_capability` | false |
| `get_import_fx_case_money_overview` | false |
| `post_import_fx_agent_advance` | **true** |
| `post_import_fx_usd_acquisition` | **true** |
| `reverse_import_fx_agent_advance` | **true** |
| `reverse_import_fx_usd_acquisition` | **true** |

Case accounting after first money: **`PARTIALLY_POSTED`** only (never final `POSTED` in W3).

---

## 4. Journals (Profile A)

| Event | Dr | Cr |
|-------|----|----|
| Advance | Clearing | Cash/Bank |
| USD CREDIT | USD/TT wallet | Agent AP |
| USD ADVANCE | USD/TT wallet | Clearing |
| USD MIXED | USD/TT wallet | Clearing + Agent AP |
| Reverse | Compensating invert | — |

Fee must be NULL/0. No Supplier AP, CNY, Phase-3 codes.

---

## 5. UI

- Workspace stages **Advance / Funding** and **USD Acquisition** render `ImportFxCaseW3MoneyPanel`.
- If RPC missing: shows `W3 server migration is not installed in this environment.` and blocks Confirm & Post.
- Path 21 soft-warn copy when reference filled (does not replace hard idempotency).

---

## 6. Tests

| Suite | Result |
|-------|--------|
| `src/app/lib/importFxCaseW3Helpers.test.ts` | **PASS** |
| `node scripts/qa/import-fx-w3-live-rpc-qa.mjs` (localhost) | **10/10 PASS** (2026-08-14) |
| Advance JE Δ | **+1 entry / +2 lines / 0 payments** per post; reverse adds compensating JE |
| Demo static | `import-fx-w3-demo-static-qa.mjs` **16/16 PASS** |
| Production post | **NOT RUN** |

---

## 7. How owner tests (safe)

1. Point ERP at a **localhost** Supabase/Postgres (not dincouture.pk).  
2. Apply W2/W2.1 then W3 via local apply scripts + `.env.db.local`.  
3. Settings → Multi Currency ON → pick clearing Current Asset account.  
4. Open Import FX Arrangement → ARRANGED case → Advance / USD Acquisition.  
5. Confirm & Post; inspect journal lines; reverse if needed.

**With current `.env.local` (production):** UI opens; posting remains unavailable until RPCs exist (probe fail-closed). Do **not** apply W3 migrations to production from this task.

---

## 7b. Local UI Demo Mode

**Purpose:** UX/workflow inspection of Agent Advance + USD Acquisition on a Windows PC **without** Docker, DB migrations, VPS, GitHub, or production mutations. Demo is **not** live QA and never pretends accounting was posted.

| Item | Value |
|------|--------|
| Activation flag | `VITE_IMPORT_FX_W3_DEMO=true` in **gitignored** `.env.local` only |
| Host restriction | `localhost` or `127.0.0.1` only (production domains rejected) |
| Route | `http://localhost:5173/demo/import-fx-w3` (no login; no Supabase financial providers) |
| Startup | `npm run dev:w3-demo` or `npm run dev:no-migrate` then open the URL |
| Persistence | In-memory; refresh resets unless optional **sessionStorage** checkbox is enabled (still not a database) |
| Badge | Persistent `DEMO — NOT POSTED` + header `W3 DEMO MODE — Nothing on this screen is saved or financially posted.` |

**Fake case:** `DEMO-IMPORT-FX-0001` / Demo RMB Agent / ARRANGED / `NOT_POSTED` / Planned USD 15,000 / Expected CNY 101,241 / CREDIT intention / PKR per USD 287.50 / Expected PKR 4,312,500 / Waiting Agent.

**Scenarios:** A Agent Advance · B USD on Credit · C Fully Advance Funded · D Mixed · simulated history + `Simulate Reversal — No Accounting`. W4–W6 buttons stay disabled.

**Safety:** Demo page/store do **not** call W3 RPCs or write Supabase. Real `ImportFxCaseW3MoneyPanel` stays capability-gated. Real posting remains blocked until W3 server migrations are installed on a **non-production** DB.

**Tests:** `npm run test:import-fx-w3` (helpers + demo gate/store scenarios 1–14).  
**Static:** `node scripts/qa/import-fx-w3-demo-static-qa.mjs`

**Evidence:** Owner screenshots optional after local open; this section is not a claim of live journal QA.

---

## 8. Known limitations

- Draft rows: posting is direct confirm-post (no separate draft RPC UI persistence beyond form state).  
- Soft Path 21 duplicate detection is advisory (reference-based), not a hard scan of `fx_currency_purchases`.  
- W4–W6 not implemented.  
- No Git commit/push performed.

---

## 9. Files changed (this task)

- Migrations: `20260813180000_*`, `20260813180100_*`
- `scripts/qa/apply-import-fx-w3-local.mjs`
- `src/app/lib/importFxCaseW3Helpers.ts` (+ test)
- `src/app/services/importFxCaseW3Service.ts`
- `src/app/features/import-fx-case/ImportFxCaseW3MoneyPanel.tsx`
- `ImportFxCaseWorkspace.tsx`, `importFxCaseHelpers.ts`
- `SettingsContext.tsx`, `SettingsPageNew.tsx`
- **Demo Mode:** `importFxW3DemoGate.ts`, `importFxW3DemoStore.ts`, `ImportFxW3DemoPage.tsx`, `importFxW3DemoGate.test.ts`, `App.tsx` demo route, `package.json` `dev:w3-demo` / `test:import-fx-w3`
- This QA doc + index/rule pointers

---

## 10. W4 handoff

Requires ≥1 **ACTIVE** USD lot with remaining qty/carrying from W3. Do not start W4 until W3 QA on non-prod passes and owner approves.
