# VPS CPU / Performance Session — Work Done (2026-06-08)

**Date:** 2026-06-08  
**Repo:** NEWPOSV3  
**VPS host:** `dincouture-vps` (`ssh dincouture-vps`)  
**Domains:** `erp.dincouture.pk`, `supabase.dincouture.pk`  
**Related:** [PRODUCTION_SERVICE.md](../deploy/PRODUCTION_SERVICE.md), [2026-06-08-MAC-MOBILE-UX-SESSION-WORK-DONE.md](./2026-06-08-MAC-MOBILE-UX-SESSION-WORK-DONE.md)

---

## 1. Executive summary

| Area | Problem | Fix / outcome |
|------|---------|---------------|
| **VPS CPU spikes** | High load, zombie `[node]` processes, autovacuum on `_supabase` Logflare tables | Diagnostic scripts + Logflare trim + Supabase healthcheck patch |
| **Auto-deploy cron** | `*/5` pull/build overlapped, full `--no-cache` Docker builds | Hourly cron + `flock` lock + cached builds by default |
| **PostgREST load** | Continuous fetches to `journal_entries`, `sales`, `rentals` | Web pagination/gating + additive DB indexes |
| **Supabase healthchecks** | `meta` / `studio` at `5s` interval spawned excess healthcheck PIDs | Patch script: `5s` → `30s`, recreate only those services |
| **ERP Mobile boot** | React Hooks order crash after auth (`App.tsx:726`) | Back-button `useEffect` moved above early returns |

---

## 2. Root causes identified

1. **Logflare `_analytics.log_events_*`** — millions of rows in `_supabase` DB drove long autovacuum cycles and CPU.
2. **Aggressive Docker healthchecks** — Supabase `meta` and `studio` services checked every 5s, leaving zombie node processes.
3. **Overlapping deploys** — cron every 5 minutes + `--no-cache` ERP builds competed for CPU.
4. **Frontend query patterns** — unbounded journal/sales/rental list fetches and fallback-poll refreshes hit PostgREST continuously.

---

## 3. New VPS scripts (repo: `deploy/`)

| Script | Purpose | Safe to re-run? |
|--------|---------|-----------------|
| [`vps-cpu-diagnose.sh`](../deploy/vps-cpu-diagnose.sh) | One-shot load, zombies, container health, autovacuum, dead tuples, active queries | Yes (read-only) |
| [`vps-cpu-diagnose.sql`](../deploy/vps-cpu-diagnose.sql) | SQL companion for Postgres vacuum / log_events size | Yes (read-only) |
| [`vps-log-events-age.sql`](../deploy/vps-log-events-age.sql) | Log events row counts by day | Yes (read-only) |
| [`vps-trim-logflare-logs.sh`](../deploy/vps-trim-logflare-logs.sh) | Batch-delete log_events older than 2 days; daily cron candidate | Yes (retention configurable) |
| [`vps-cpu-relief-now.sh`](../deploy/vps-cpu-relief-now.sh) | Emergency relief: stop stuck deploys, trim logs, fix crontab | Yes (idempotent) |
| [`vps-patch-supabase-healthchecks.sh`](../deploy/vps-patch-supabase-healthchecks.sh) | Patch `/root/supabase/docker/docker-compose.yml` — meta/studio `30s` interval | Yes (backs up compose first) |
| [`vps-stabilize-diagnose.sh`](../deploy/vps-stabilize-diagnose.sh) | Broader stabilize snapshot: stats, healthcheck PIDs, ERP curl | Yes (read-only) |
| [`vps-settle-verify.sh`](../deploy/vps-settle-verify.sh) | Post-trim verification: rows, vacuum progress, load | Yes (read-only) |
| [`vps-n8n-investigate.sh`](../deploy/vps-n8n-investigate.sh) | n8n service CPU investigation (Swarm service `dincouture-n8n`) | Yes (read-only + log capture) |

---

## 4. Modified deploy tooling

### [`deploy/vps-auto-pull-cron.sh`](../deploy/vps-auto-pull-cron.sh)

- **`flock`** on `/var/lock/newposv3-deploy.lock` — skip if deploy already running.
- Recommended cron (hourly, not every 5 min):
  ```cron
  0 * * * * flock -n /var/lock/newposv3-deploy.lock /root/NEWPOSV3/deploy/vps-auto-pull-cron.sh
  ```
- Passes `DEPLOY_NO_CACHE=0` by default (cached Docker build).

### [`deploy/deploy.sh`](../deploy/deploy.sh)

- Docker `node:20-alpine` helper runs with **`--init`** (cleaner child process reaping).
- **`DEPLOY_NO_CACHE=1`** opt-in for full rebuild; default uses Docker layer cache.
- Manual full rebuild:
  ```bash
  DEPLOY_NO_CACHE=1 bash deploy/deploy.sh
  ```

### [`deploy/PRODUCTION_SERVICE.md`](../deploy/PRODUCTION_SERVICE.md)

- Documented Supabase healthcheck CPU relief procedure.
- Documented frontend API load checklist (built container, deploy, indexes).

---

## 5. Recommended VPS runbook

### Quick diagnosis

```bash
ssh dincouture-vps
cd /root/NEWPOSV3 && bash deploy/vps-cpu-diagnose.sh
```

### Emergency CPU relief

```bash
cd /root/NEWPOSV3 && bash deploy/vps-cpu-relief-now.sh
```

This script:

1. Stops overlapping `deploy.sh` / auto-pull processes.
2. Trims Logflare rows (2-day retention).
3. Updates crontab: hourly auto-pull + daily 04:15 log trim.

### Supabase healthcheck patch (coordinate with team if DB maintenance active)

```bash
cd /root/NEWPOSV3 && bash deploy/vps-patch-supabase-healthchecks.sh
```

### Verify after trim / patch

```bash
bash deploy/vps-settle-verify.sh
curl -sS -o /dev/null -w 'erp:%{http_code}\n' https://erp.dincouture.pk/
```

### Daily log maintenance (cron)

```cron
15 4 * * * /root/NEWPOSV3/deploy/vps-trim-logflare-logs.sh >> /var/log/logflare-trim.log 2>&1
```

Optional env overrides for trim script:

- `LOGFLARE_RETENTION_DAYS=2`
- `LOGFLARE_TRIM_BATCH=50000`

---

## 6. Database — query filter indexes

**Migration:** [`migrations/20260608_query_filter_indexes.sql`](../migrations/20260608_query_filter_indexes.sql)

Additive `IF NOT EXISTS` indexes:

| Index | Table | Columns |
|-------|-------|---------|
| `idx_sales_company_status` | `sales` | `company_id, status` |
| `idx_sales_company_branch_status` | `sales` | `company_id, branch_id, status` |
| `idx_rentals_company_status_created` | `rentals` | `company_id, status, created_at DESC` |
| `idx_rentals_created_by` | `rentals` | `created_by` (if column exists) |
| `idx_accounts_company_is_active` | `accounts` | `company_id, is_active` |

Apply via your usual forward migration path on production Postgres.

---

## 7. Web ERP — API load reduction (same session)

| File | Change |
|------|--------|
| [`src/app/context/AccountingContext.tsx`](../src/app/context/AccountingContext.tsx) | Paginated journal fetch (500/page), skip fallback-poll reload when module closed |
| [`src/app/services/accountingService.ts`](../src/app/services/accountingService.ts) | `getAllEntries` supports `limit` / `offset` + total count |
| [`src/app/context/SalesContext.tsx`](../src/app/context/SalesContext.tsx) | Tighter list fetch / invalidation gating |
| [`src/app/context/RentalContext.tsx`](../src/app/context/RentalContext.tsx) | Rental list query optimization |
| [`src/app/services/rentalService.ts`](../src/app/services/rentalService.ts) | Filter-aligned rental queries |
| [`src/app/components/sales/SalesPage.tsx`](../src/app/components/sales/SalesPage.tsx) | Sales list alignment with context changes |
| [`src/app/lib/WebRealtimeBridge.tsx`](../src/app/lib/WebRealtimeBridge.tsx) | Realtime refresh coalescing / noise reduction |

**Deploy web fixes to VPS:**

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/deploy.sh"
```

---

## 8. ERP Mobile — Hooks crash fix

**File:** [`erp-mobile-app/src/App.tsx`](../erp-mobile-app/src/App.tsx)

Hardware back-button `useEffect` was placed after conditional early returns (loading / login / branch-selection). After auth completed, React saw an extra hook and crashed.

**Fix:** Move effect above early returns; guard with `authLoading`, screen name, and lock-overlay checks.

---

## 9. n8n side investigation

[`deploy/vps-n8n-investigate.sh`](../deploy/vps-n8n-investigate.sh) captures:

- Swarm service env / CPU limits for `dincouture-n8n`
- Container logs → `/root/n8n-current-high-cpu.log`
- SQLite execution counts (if local DB)
- ERP + Supabase health curls

Use when n8n appears in `docker stats` top CPU after Logflare/healthcheck relief.

---

## 10. What was **not** changed

- No destructive DB migrations (DROP / RLS bulk changes).
- Supabase Postgres **data volumes** untouched by healthcheck patch.
- GL / sale finalize semantics unchanged.

---

## 11. Follow-up checklist

- [ ] Apply `migrations/20260608_query_filter_indexes.sql` on production if not already applied
- [ ] Confirm VPS crontab matches hourly auto-pull + daily log trim
- [ ] Run `vps-settle-verify.sh` after next trim and record baseline load
- [ ] Deploy latest ERP (`deploy/deploy.sh`) so pagination fixes are live on `erp.dincouture.pk`
- [ ] Monitor `_analytics.log_events_*` row count weekly

---

## 12. Quick reference

```bash
# SSH (always use config host)
ssh dincouture-vps

# Diagnose
cd /root/NEWPOSV3 && bash deploy/vps-cpu-diagnose.sh

# Relief
bash deploy/vps-cpu-relief-now.sh

# Healthcheck patch
bash deploy/vps-patch-supabase-healthchecks.sh

# Deploy ERP (cached)
bash deploy/deploy.sh

# Deploy ERP (full rebuild)
DEPLOY_NO_CACHE=1 bash deploy/deploy.sh
```
