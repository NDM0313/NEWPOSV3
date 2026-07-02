# Transaction Actions — Batch A Deploy Report

**Deploy date/time:** 2026-06-23 ~10:52 UTC  
**Branch deployed:** `feature/accounting-transaction-actions-batch-a`  
**Commit deployed:** `76b60f724bbb5628b1bc0e2805d6d2cb0b1610c3` (`76b60f72`)  
**Batch A code commit:** `4d8ecf91` (included in `76b60f72` history)

---

## Pre-deploy verification (local)

| Check | Result |
|-------|--------|
| Branch | `feature/accounting-transaction-actions-batch-a` |
| HEAD includes `76b60f72` | Yes |
| `transactionActionsRegistry.test.ts` + `transactionActionRules.test.ts` | **13/13 pass** |
| `npm run build` | **Pass** |
| `.env.local` staged | **No** |
| Unrelated WIP staged | **No** |

---

## VPS deploy

### Main repo state (unchanged)

| Item | Value |
|------|-------|
| Path | `/root/NEWPOSV3` |
| Branch | `main` |
| Commit | `7ee19f02a63db50f402b81a8edd3e2b3839e9f0d` |
| Dirty | **Yes** — deploy aborted on dirty main per safety rule |

**Dirty files (sample):** modified `deploy/backup-page/*`; untracked phase-f migration scripts, misplaced `src/app/*.tsx` WIP, etc. Main repo was **not** checked out or reset.

### Deploy method (frontend-only)

Because `/root/NEWPOSV3` was dirty, deploy used an **isolated clone**:

| Item | Value |
|------|-------|
| Clone path | `/root/NEWPOSV3-batch-a-deploy` |
| Mechanism | Docker rebuild `erp` service only (`deploy/docker-compose.prod.yml`) |
| Migrations run | **None** |
| Supabase / DB touched | **No** |
| `.env.production` | Copied read-only from `/root/NEWPOSV3/.env.production` (existing production keys) |

**Commands executed (agent via `ssh dincouture-vps`):**

1. Tag rollback image: `deploy-erp:rollback-before-batch-a-20260623104840`
2. Clone + `git reset --hard origin/feature/accounting-transaction-actions-batch-a`
3. `docker compose -f deploy/docker-compose.prod.yml build erp`
4. `docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate erp`

**Note:** First deploy script hit a CRLF `pipefail` artifact and briefly triggered rollback; immediate redeploy from cached Docker layers restored Batch A image successfully.

### Previous production frontend (rollback target)

| Item | Value |
|------|-------|
| Previous `erp-frontend` image | `sha256:3ea3d74fdc8b3bfcd2803d5a7b9bd5ccdd33e3392691279b73d70e555533a157` |
| Rollback tag preserved | `deploy-erp:rollback-before-batch-a-20260623104840` |
| Retry rollback tag | `deploy-erp:rollback-before-batch-a-retry-*` (timestamped at redeploy) |

**Rollback command (if needed):**

```bash
ssh dincouture-vps 'docker tag deploy-erp:rollback-before-batch-a-20260623104840 deploy-erp && cd /root/NEWPOSV3 && docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --force-recreate erp'
```

---

## Health check

```text
HTTP/2 200
server: nginx/1.29.6
content-type: text/html
```

`erp-frontend` container: **Up (healthy)** after redeploy.

---

## Smoke check

| Check | Result |
|-------|--------|
| `https://erp.dincouture.pk/` loads | **Pass** — login page renders ("Din Collection" / Sign In) |
| Blank page / 5xx | **None observed** |
| Deployed bundle contains Batch A labels | **Pass** — `Edit Entry` present in `/usr/share/nginx/html/assets/*.js` inside `erp-frontend` |
| Accounting screens (interactive) | **Not exercised** — requires authenticated session; no automated login credentials used |
| DB mutation on page load | **None** — static frontend only |

**Expected post-login checks (operator):**

1. Accounting → Journal Entries — normalized action labels  
2. Transaction Detail Modal — registry panel + Edit Accounts policy  
3. Account Statements — View without auto-edit; conditional Edit label  
4. Ledger Statement Center V2 — View tooltip **View**; view-only table  

---

## Safety confirmations

| Item | Confirmed |
|------|-----------|
| Frontend-only | **Yes** — Docker `erp` / nginx static assets only |
| DB migrations | **No** |
| Live DB changes | **No** |
| `unified_ledger_engine` | **Unchanged** (`.env.production` copied as-is) |
| Single Core Ledger Phase 1.5 | **Not touched** |
| PF-14 payment mechanics | **Unchanged** (no code path changes in deploy) |
| Merge to main | **No** |
| VPS main repo git state | **Unchanged** (still `main` @ `7ee19f02`, dirty) |

---

## Rollback used during deploy?

**Brief automatic rollback** occurred on first script run (CRLF trap false-positive). **Second deploy succeeded**; production currently serves Batch A commit `76b60f72`.

---

## Draft PR

https://github.com/NDM0313/NEWPOSV3/pull/new/feature/accounting-transaction-actions-batch-a

**Title:** Accounting Transaction Actions Batch A  
**Note:** Do not merge until reviewed. Frontend-only deploy completed to production ERP container; no DB migrations.

---

## Recommendation

**Monitor Batch A** in production after operator login smoke (Journal Entries, Transaction Detail, Account Statements, Ledger V2). Plan **Batch B** separately; do not merge to `main` until review complete.
