# Import FX — remaining task completion (2026-08-14)

Owner message: **approve hai complete remaining all task**.

## Completed under this approval

| Task | Result |
|------|--------|
| Sync `main` from GitHub | Done |
| W2/W2.1 localhost migrate | Done (`newposv3-local-pg`) |
| W2 live RPC QA | **38/38 PASS** · JE Δ **0/0/0/0/0** |
| QA runner fixes + docs | Done |
| Merge evidence to `main` | Done — merge commit `ff030735` (PR [#25](https://github.com/NDM0313/NEWPOSV3/pull/25) branch) |

## Still blocked (cannot complete without new targets / clearer money approval)

| Task | Why blocked |
|------|-------------|
| Live UI smoke vs non-prod HTTP API | No staging Supabase/API configured; `.env.local` → `supabase.dincouture.pk` (**production — refused** for retarget) |
| Staging Storage policy review | No staging bucket / API identified |
| Production DB migrate / deploy | Staging-first gate not satisfied; no dedicated non-prod HTTP staging; will not apply Import FX SQL to VPS/`dincouture` without an explicit **“migrate production database now”** follow-up after staging |
| W3 draft [PR #24](https://github.com/NDM0313/NEWPOSV3/pull/24) | Draft money path (Agent Advance + USD). Not merged — needs **separate W3 money-posting approval** (not implied by W2 QA close-out) |

## Production confirmation

**Production was not migrated or deployed in this pass.**

To unblock production migrate, provide either:

1. Confirmed staging Supabase/VPS clone + approval to apply W1→W2.1 there first, **then** production, or  
2. Explicit one-line: `migrate production database now for Import FX W1–W2.1` (accepting money/stock/invoice risk) **and** a production DB admin URL source that is not casually reused from backup files without you naming it.
