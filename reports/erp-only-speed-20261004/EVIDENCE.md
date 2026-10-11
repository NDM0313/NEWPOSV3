# ERP-only speed relief — 2026-10-04

## Goal

Cut non-ERP VPS load and stop Accounting from waking full Sales / Purchase / Expense lists so journal entry work stays fast.

## VPS (Track A) — applied on `dincouture-vps`

**Kept:** `supabase-db`, `supabase-kong`, `supabase-auth`, `supabase-rest`, `supabase-storage`, `erp-frontend`, `dokploy-traefik`.

**Scaled to 0:** `instagram-media-helper`, `dokploy`, `dokploy-postgres`, `dokploy-redis`, `dincouture-n8n` (already 0).

**Stopped:** `erp-frontend-preview`, `supabase-studio`, `supabase-vector`, `supabase-imgproxy`, `erp-mobile`.

**Cron:** removed `vps-auto-pull-cron.sh` (and kong/studio auto-repair if present). Nightly DB backup kept. Crontab backup: `/root/crontab.bak.erp-only.202610041326`.

**Logflare:** trimmed ~2.3M `_analytics` log rows (retention 2d), then stopped mid-run so delete I/O would not fight entry work. Nightly trim cron remains (`15 4 * * *`).

**Post-relief snapshot:** load ~2.3; `https://erp.dincouture.pk/` → 200; PG sessions ~23.

## App code (Track B)

| Change | File |
|--------|------|
| Vite `/supabase` proxy timeouts + Host/Origin + error log | `vite.config.ts` |
| Lean Day Book select + adaptive limit | `src/app/lib/journalEntriesListSelect.ts` (+ test), `accountingService.ts`, `AccountingContext.tsx` |
| Lazy Receivables/Payables panels (no mount-time Sales/Purchase/Expense activate) | `AccountingDashboard.tsx` |
| Party-GL only on Accounts tab | `AccountingDashboard.tsx` |
| Skip idle journal→balance sync on Day Book bootstrap | `AccountingContext.tsx` |
| Notification due queries only when bell opens | `NotificationsDropdown.tsx` |

## Verify

- Local password grant via `localhost:5173/supabase/auth/v1/token` → 200 (no 504).
- Lean `journal_entries?select=…&limit=100` → 200 (~5.5s), no 57014.

## Note

Production `erp-frontend` image was **not** rebuilt in this relief window (avoid CPU spike). Boot-storm cut is on local Vite until the next erp deploy.
