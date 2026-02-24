# 502 Fix & Mobile Login

## Problem
- **502 Bad Gateway** on `erp.dincouture.pk/auth/v1/*` and `/rest/v1/*`
- Mobile app (localhost:5174) fails to login when using `VITE_SUPABASE_URL=https://erp.dincouture.pk`

## Root Cause
Nginx in the ERP container could not resolve `supabase-kong` at runtime (Docker DNS). Added `resolver 127.0.0.11` and variable-based `proxy_pass` to fix.

## Immediate Fix for Mobile App (Local Dev)
**Use `supabase.dincouture.pk` directly** – it works reliably:

1. In project root `.env.local` (or `.env`):
   ```
   VITE_SUPABASE_URL=https://supabase.dincouture.pk
   VITE_SUPABASE_ANON_KEY=<your-anon-key-from-VPS>
   ```

2. Sync env and start mobile app (one command):
   ```bash
   npm run mobile:dev
   ```
   This runs `sync:mobile-env` then starts the mobile dev server.

## Status
- `https://supabase.dincouture.pk` → ✅ Works (401/JSON from Kong)
- `https://erp.dincouture.pk` → 502 fixed; Kong routing may need further tuning for same-origin proxy
