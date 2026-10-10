# Phase 2.10B — Preview deploy notes

**Status:** `PHASE 2.10B PREVIEW BASELINE QA PASS — ready for loader-flag candidate approval`  
**Timestamp (UTC):** 2026-06-26  
**Target:** `erp-frontend-preview` on VPS **:3003** only  
**Tunnel:** `ssh -N -L 3002:127.0.0.1:3003 dincouture-vps` → http://localhost:3002  
**Production:** `erp-frontend` / `erp.dincouture.pk` **not touched**

## Deploy

| Item | Value |
|------|-------|
| Build label | `phase-210b-minimal` |
| Script | `scripts/single-core-ledger/deploy-phase-210b-preview-frontend-vps.sh` |
| Worktree | `/root/NEWPOSV3-preview-qa` |
| Rollback tag | `erp-frontend-preview:rollback-before-210b-*` |

### Circular dependency fix (deploy blocker)

Initial full 2.10A page + `unifiedFetch` → `ledgerStatementCenterV2Service` import caused runtime error on `/reports/ledger-statement-center-v2` (`Cannot access 'xe' before initialization`).

**Resolution:**
- Minimal `LedgerStatementCenterV2Page` patch (dynamic import resolver + main loader only)
- Reverted preview service to inline unified RPC (no `ledgerStatementCenterV2Service` import in fetch path)
- Added `ledgerStatementCenterV2Scopes.ts` for branch scope constant

## Bundle verification

| String | Status |
|--------|--------|
| `data-ledger-v2-main-loader` | FOUND in `AccountingDashboard-*.js` |
| `unified_ledger_loader_ledger_v2` | FOUND in lazy chunk / map (flag key in resolver module) |
| `resolveLedgerV2MainLoaderSource` | FOUND in async chunk (dynamic import) |

## Not executed

- Loader flag SQL
- `deploy/deploy.sh` / migrations
- Production frontend replace

## Rollback

L1 loader rollback SQL documented — not run during 2.10B:

`scripts/single-core-ledger/phase-210-rollback-loader-ledger-v2.sql`

Instant effect when run: `unified_ledger_loader_ledger_v2` OFF → main table legacy.
