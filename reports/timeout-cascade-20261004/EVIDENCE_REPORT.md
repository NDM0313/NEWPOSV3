# Statement-timeout cascade — evidence report (2026-10-04)

## PROVEN

### Client / network (browser console + PostgREST logs)

- Production returned SQLSTATE `57014` (`canceling statement due to statement timeout`) for:
  - `rpc/get_dashboard_v2_snapshot`
  - `rpc/get_dashboard_metrics` (fallback)
  - `journal_entries` with nested `journal_entry_lines` + `accounts`, `entry_date=gte.2016-01-01`
  - nested `sales` / `purchases` / `rentals` list selects
  - batched `journal_entry_lines` account balance scans
- Some `payments` requests returned `502` under the same load window.
- PostgREST log (prod) confirms the exact failing JE URL shape:
  - `GET /journal_entries?...lines:journal_entry_lines(...account:accounts...)...entry_date=gte.2016-01-01...limit=500` → `500` + `57014`
- Global Filter **From start** = Jan 1 of `(year - 10)` → `2016-01-01` in 2026 ([`GlobalFilterContext.tsx`](../../src/app/context/GlobalFilterContext.tsx)).

### VPS readonly diagnostics (2026-10-04 ~09:25–09:27 UTC)

| Check | Result |
|-------|--------|
| Host CPUs | **2** |
| Load average | **12.91 / 6.42 / 6.47** (later 11.20) — severely oversubscribed |
| Memory | 7.8 Gi total; ~5.4 Gi available (not the primary bottleneck) |
| Top CPU | n8n task-runner ~33%, dockerd ~27%, n8n main ~7% |
| `supabase-db` | running, healthy |
| `supabase-rest` / `supabase-kong` | running |
| `supabase-auth` | running, healthy, but **restart count = 227** |
| `erp-frontend` | running, healthy (started ~08:59) |
| DB `statement_timeout` (global) | `0` (disabled) |
| Role `authenticated` | **`statement_timeout=8s`** |
| Role `authenticator` | **`statement_timeout=8s`, `lock_timeout=8s`** |
| Role `anon` | `statement_timeout=3s` |
| Indexes present | All five checked: JE company/date, JE company/branch/date, JE lines by JE id, JE lines by account, sales company/branch/invoice_date |
| `get_dashboard_v2_snapshot` | Live; `src_len=12381`; calls `get_dashboard_metrics`; has `branch_breakdown`; **no** `FOR … IN SELECT` loop |
| `get_dashboard_metrics` | Live; `src_len=10574`; has `generate_series` |
| Migrations recorded | Includes `20260610120000_dashboard_v2_snapshot_rpc.sql`, **`20260723120000_dashboard_metrics_set_based.sql`**, `report_performance_indexes.sql`, `journal_entry_lines_performance_indexes.sql` |
| Table sizes (approx live tuples) | JE 6647 / lines 13717 / sales 181 / payments 915 / rentals 4 — **small**; timeouts are not “millions of rows” |

### Root-cause synthesis

1. **Hard 8s `authenticated` statement_timeout** cancels any query slower than 8s (including under CPU contention).
2. **Host overload (2 vCPU, load ~11–13)** from n8n + docker makes even modest RLS/join queries miss the 8s budget.
3. **Client stampede**: login/accounting opens many concurrent heavy selects; **From start** JE nested embed (2016→today) is the worst offender on deployed HEAD.
4. **Not** missing set-based dashboard RPC or JE indexes — those are already on prod.

## CHANGED (local workspace — not yet deployed)

| File | Change |
|------|--------|
| [`src/app/lib/wideDateRangeClamp.ts`](../../src/app/lib/wideDateRangeClamp.ts) | NEW — clamp spans >366 days to calendar year-start → end |
| [`src/app/lib/wideDateRangeClamp.test.ts`](../../src/app/lib/wideDateRangeClamp.test.ts) | NEW — unit tests |
| [`src/app/lib/dashboardV2Period.ts`](../../src/app/lib/dashboardV2Period.ts) | Re-export clamp / timeout helpers |
| [`src/app/services/dashboardV2Service.ts`](../../src/app/services/dashboardV2Service.ts) | Clamp before RPC; skip metrics fallback on 57014 |
| [`src/app/components/dashboard/v2/DashboardV2Page.tsx`](../../src/app/components/dashboard/v2/DashboardV2Page.tsx) | Clamp banner (statements still use full filter) |
| [`src/app/context/AccountingContext.tsx`](../../src/app/context/AccountingContext.tsx) | Clamp + one lean page + dedupe + 57014 retry toast |
| [`src/app/services/accountingService.ts`](../../src/app/services/accountingService.ts) | List mode: headers only, no exact count |
| [`src/app/components/accounting/AccountingDashboard.tsx`](../../src/app/components/accounting/AccountingDashboard.tsx) | Day Book clamp banner |
| [`src/app/components/reports/DayBookReport.tsx`](../../src/app/components/reports/DayBookReport.tsx) | Clamp + max 2×500 pages (pre-existing in WT) |

## VERIFIED

- Unit tests: `wideDateRangeClamp.test.ts` + `dashboardV2Period.test.ts` → **9 passed, 0 failed** (`npx tsx --test …`).
- VPS readonly SQL + `deploy/vps-cpu-diagnose.sh` + PostgREST logs as above.

## UNTESTED

- Post-deploy browser smoke with Global Filter **From start** (needs frontend deploy approval).
- Any change to Postgres role `statement_timeout` (not applied).

## NOT TOUCHED

- Production migrations / role timeout ALTER / container restarts / n8n changes.
- Sales / rentals list query redesign (follow-up if still hot after frontend deploy).
- Unrelated dirty tree files (`deploy/staging-je-guard/_tmp_*`, ledger services, etc.).

## Approval-gated ops recommendations (do not apply without explicit OK)

1. **Frontend deploy** of the CHANGED client files (primary fix for From-start JE stampede).
2. Consider raising `authenticated` / `authenticator` `statement_timeout` from **8s → 30s** (and revisit `lock_timeout`) — only after confirming this is intentional policy; 8s is unusually tight for ERP RPCs on a 2-vCPU host.
3. **Reduce host contention**: n8n task-runner was ~33% CPU during load 12 — move/limit n8n or add CPU before expecting dashboard RPCs to stay under 8s under concurrent use.
4. Investigate `supabase-auth` **restart=227** (separate stability issue; may amplify login storms).
5. Indexes / set-based dashboard RPC: **no apply needed** — already present.

## Immediate workaround (no deploy)

Switch Global Filter from **From start** → **Current Financial Year** or **Last 30 days**, then hard-refresh.

## Deploy verification (2026-10-04 ~11:04 UTC)

| Check | Result |
|-------|--------|
| Commits on `main` | `2289def3` (clamp) + `3afeeb0a` (dockerignore shrink) |
| VPS `HEAD` | `3afeeb0a` |
| `erp-frontend` | healthy on new `deploy-erp` image; HTTP **200** |
| Bundle smoke | `CLAMP_OK` — `"too wide for"` present in `/usr/share/nginx/html/assets/*.js` |
| n8n | Temporarily scaled to **0** during dual `npm ci` (host load peaked ~42 on 2 vCPU); restored to **1/1 Running** after rebuild |
| First hard-rebuild attempt | Failed: Alpine `apk` TLS, then 1.4GB context, then mobile `npm ci` ECONNRESET — frontend restored from prior image in between |

**Browser smoke (operator):** hard-refresh with Global Filter **From start** → Journal/Day Book should request `gte.2026-01-01` (not 2016) and show clamp banner.
