# Import FX W3 — Safe Demo Mode session (2026-08-14)

**Branch:** `feat/import-fx-w3-advance-usd-demo` (Draft [PR #24](https://github.com/NDM0313/NEWPOSV3/pull/24))  
**Mode:** Safe Demo only — **no journals, no production migrate, no merge to `main`**

## Enabled

| Item | Result |
|------|--------|
| Git checkout | `feat/import-fx-w3-advance-usd-demo` @ `6309875f` |
| `.env.local` | `VITE_IMPORT_FX_W3_DEMO=true` (gitignored) |
| `VITE_SUPABASE_URL` | **Unchanged** (`supabase.dincouture.pk` left intact; not used by demo route) |
| Dev server | `npx vite --host 127.0.0.1 --port 5173` |
| Demo URL | http://127.0.0.1:5173/demo/import-fx-w3 |
| Badge | **`DEMO — NOT POSTED`** verified in browser |
| Unit | `npm run test:import-fx-w3` → **19/19 PASS** |
| Static | `node scripts/qa/import-fx-w3-demo-static-qa.mjs` → **16/16 PASS** |

## How to open (Mac)

```bash
git checkout feat/import-fx-w3-advance-usd-demo
# ensure .env.local has: VITE_IMPORT_FX_W3_DEMO=true
npm run dev:w3-demo
# or: npx vite --host 127.0.0.1 --port 5173 → open /demo/import-fx-w3
```

Use the **Scenario A — Agent Advance** and **Scenarios B–D — USD Acquisition** panels. All posts are in-memory simulation (`posts_journal: false`).

## Explicitly deferred (final finish later)

| Item | Status |
|------|--------|
| Live W3 Confirm & Post (journals) on localhost Docker | Deferred |
| W3 money migrations apply to non-prod/prod | Deferred |
| Clearing account Settings config for live post | Deferred |
| W4–W6 (China transfer → reconciliation) | Out of scope / disabled in demo |
| Merge PR #24 → `main` | **Not done** (auto-deploy risk) |
| Production DB / VPS migrate | **Not touched** |

Canonical later path: [`IMPORT_FX_W3_MACBOOK_HANDOFF.md`](./IMPORT_FX_W3_MACBOOK_HANDOFF.md) §4 + [`IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md`](./IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md).
