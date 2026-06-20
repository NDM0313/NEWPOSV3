# Single Core Ledger — Systemwide Diagnostic Report

> **Status: NETWORK_BLOCKED** — staging Supabase Cloud project DNS unreachable from validation environment.

## Run metadata

| Field | Value |
|-------|-------|
| Run timestamp (UTC) | 2026-06-20 (validation attempt) |
| companies_count | 0 |
| JSON output path | `reports/single-core-ledger/diagnostics-network-blocked-2026-06-20.json` |
| JSON SHA256 | _(see file on disk after commit)_ |
| Overall status | **NETWORK_BLOCKED** |
| Staging guard | `UNIFIED_LEDGER_STAGING=1` |
| VPS blocked | Yes (`supabase.dincouture.pk` / `72.62.254.176` rejected by guard) |

## Blocker

- `wrwljqzckmnmuphwhslt.supabase.co` → DNS `ENOTFOUND`
- `db.wrwljqzckmnmuphwhslt.supabase.co` → DNS `ENOTFOUND`
- Supabase REST `fetch failed` (same root cause)
- Phase 1.5 migrations **not applied** (no DB connectivity)

## Pass / fail summary

_Not computed — no staging DB connection._

## DIN CHINA pilot section

_Not executed._ Pilot config: `scripts/single-core-ledger/pilot-companies.json` (`30bd8592-3384-4f34-899a-f3907e336485`).

## branch_attribution_risk / fix_class

_Not computed._

## Remediation (operator)

1. Restore reachable **staging clone** (not VPS production).
2. Update `.env.local` with staging `DATABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. `node scripts/apply-unified-ledger-phase-15-migrations.mjs`
4. `node scripts/run-single-core-ledger-diagnostics.mjs --write-report`
