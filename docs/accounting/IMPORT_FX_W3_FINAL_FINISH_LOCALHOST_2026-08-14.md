# Import FX W3 — Final finish (localhost live) 2026-08-14

**Branch:** `feat/import-fx-w3-advance-usd-demo` (Draft PR #24 — **not** merged to `main`)  
**Target:** `localhost:5432/postgres` · `newposv3-local-pg`  
**Production:** **Not touched** (`supabase.dincouture.pk` / VPS unused)

## Completed

| Step | Result |
|------|--------|
| W3 migrations | Applied via `node scripts/qa/apply-import-fx-w3-local.mjs` |
| Files | `20260813180000_…`, `20260813180100_…` |
| Capability | `import_fx_w3_capability().installed = true` |
| Local harness | `scripts/qa/import-fx-w3-local-harness.sql` (JE column stubs + control-code stub) |
| Live RPC QA | `node scripts/qa/import-fx-w3-live-rpc-qa.mjs` → **10/10 PASS** |
| Advance post | JE Δ **+1 / +2 / 0** (entries / lines / payments) |
| Idempotent replay | No extra JE |
| Reverse | Compensating JE posted; payments stay 0 |
| UI timeline | ADVANCE + USD selectable; W4+ still blocked |
| Demo Mode | Still available at `/demo/import-fx-w3` (safe UX) |

## Operator path (live UI vs production API)

Localhost Docker has W3 RPCs. The Vite app `.env.local` still points at **production** HTTP API for normal ERP login — do **not** post live money through that UI until a non-prod Supabase/API is configured.

To exercise live Confirm & Post against this Docker DB you need either:

1. A temporary non-prod HTTP API wired to `newposv3-local-pg`, or  
2. Continue using `import-fx-w3-live-rpc-qa.mjs` (proven) / SQL RPC calls on localhost

Demo Mode remains the safe browser check without journals.

## Explicitly still deferred

- Merge PR #24 → `main` (auto-deploy risk)  
- Production / VPS W3 migrate  
- Multi Currency enablement in production  
- W4–W6 money stages  
- Live browser Confirm & Post against `supabase.dincouture.pk`
