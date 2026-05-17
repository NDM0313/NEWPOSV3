# Mobile web (`/m/`) login — fix demo anon key and “User profile not found”

Production URL example: `https://erp.dincouture.pk/m/`

## 1. Amber banner: “Wrong Supabase anon key (demo JWT)”

The PWA is built with **Vite**; `VITE_SUPABASE_ANON_KEY` is baked into the JS bundle. If it matches the **public Supabase tutorial** JWT signature, the app shows this banner (see [`erp-mobile-app/src/lib/supabase.ts`](../erp-mobile-app/src/lib/supabase.ts) and [`LoginScreen.tsx`](../erp-mobile-app/src/components/LoginScreen.tsx)).

**Fix**

- **Local / CI before any mobile build:** from repo root run `npm run sync:mobile-env` so [`erp-mobile-app/.env`](../erp-mobile-app/.env) gets `VITE_SUPABASE_*` from root `.env.production` / `.env.local` / `.env` (see [`scripts/sync-mobile-env.js`](../scripts/sync-mobile-env.js)).
- **VPS:** run `bash deploy/deploy.sh`. The script writes root `.env.production`, then **refuses to build** if the anon key is empty or still the upstream demo JWT (`node scripts/verify-mobile-build-env.mjs`).
- After deploy, hard-refresh the browser (Ctrl+F5) so the old bundle is not cached.

**Manual check:** `node scripts/verify-mobile-build-env.mjs` (defaults to `.env.production` in repo root).

## 2. Red error: “User profile not found. Create a business in the web app first.”

After a successful `signInWithPassword`, the app loads **`public.users`** where `id` or `auth_user_id` equals `auth.users.id` (see [`erp-mobile-app/src/api/auth.ts`](../erp-mobile-app/src/api/auth.ts)). No row → this message.

**Fix (after the anon key points at the correct Supabase project)**

1. In **Supabase Studio** (Auth): confirm the email exists in `auth.users` and copy its **UUID**.
2. In **Table Editor** → `public.users`: confirm a row exists with either:
   - `id` = that UUID, or  
   - `auth_user_id` = that UUID  
3. If the user exists in Auth but not in `public.users`:
   - Use **Web ERP** onboarding (“Create business”) for that account, **or**
   - Run linking SQL your repo ships for this case, e.g. [`deploy/link-mobile-auth-users.sql`](../deploy/link-mobile-auth-users.sql) or [`migrations/link_auth_users_to_public_users.sql`](../migrations/link_auth_users_to_public_users.sql) (see also [`deploy/LOCALHOST_LOGIN_DEBUG.md`](./LOCALHOST_LOGIN_DEBUG.md)).

## Related scripts

| Command | Purpose |
|---------|---------|
| `npm run sync:mobile-env` | Copy root Supabase URL/key into `erp-mobile-app/.env` |
| `node scripts/verify-mobile-build-env.mjs` | Exit non-zero if key missing or demo tutorial JWT |
