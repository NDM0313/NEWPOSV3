# ERP Mobile — Staging PWA clone

Isolated copy of `erp-mobile-app` for **staging Supabase** only.

| | Production (`erp-mobile-app`) | This clone |
|---|---|---|
| API | `https://api.ndmcore.com` | `https://api-stage.ndmcore.com` |
| Web ERP | `https://erp.ndmcore.com` / `:3001` | `https://erp-stage.ndmcore.com` / `:3002` |
| App ID | `com.dincouture.erp` | `com.dincouture.erp.stage` |

**Do not modify** the original `erp-mobile-app/` folder for staging work.

## Quick start (PWA on phone)

```bash
cd erp-mobile-app-stage
npm install
npm run serve:pwa
# → http://<your-lan-ip>:4175
```

On the phone (same Wi‑Fi): open `http://<lan-ip>:4175`, then **Add to Home Screen**.

Dev (hot reload, Vite proxy → api-stage on **:5174**):

```bash
npm run env:staging   # writes .env from env.staging
npm run dev
# → http://localhost:5174
# If you see plain "Unauthorized" / JSON parse errors: hard-refresh,
# Application → Clear site data, then restart Vite (stale prod tokens).
```

## Env

Committed template: [`env.staging`](./env.staging)

```text
VITE_SUPABASE_URL=https://api-stage.ndmcore.com
VITE_SUPABASE_ANON_KEY=<staging anon key>
```

`npm run env:staging` copies it to `.env` / `.env.production` (gitignored).

## Staging web ERP (already on VPS)

Open **https://erp-stage.ndmcore.com** in a mobile browser — that is the staging web frontend baked against `api-stage.ndmcore.com` (separate from this PWA clone).
