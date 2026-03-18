# Fix: 401 Unauthorized on login (any account) – localhost & VPS

When **every** login (ndm313@yahoo.com, ndm313@live.com, Admin, Demo) returns **401 Unauthorized**, the usual cause is **anon key mismatch**: the app is sending an API key that Kong does not accept, so Kong returns 401 before the request reaches GoTrue.

## What we did on the VPS

1. **Passwords re-applied** in `auth.users` (admin, info, demo, ndm313@yahoo.com, ndm313@live.com) with correct bcrypt format.
2. **fix-supabase-kong-domain.sh** was run so Kong’s anon key is synced to `/root/NEWPOSV3/.env.production` and Auth was restarted.

## What you must do for localhost (localhost:5173)

Your **local** `.env` must use the **same** anon key as Kong. Get the key from the VPS and put it in your project’s `.env`:

1. **Get the anon key from the VPS** (run in PowerShell from your project root):

   ```powershell
   ssh dincouture-vps "grep VITE_SUPABASE_ANON_KEY /root/NEWPOSV3/.env.production"
   ```

2. **Copy the value** (the long JWT after `=`) and put it in your **local** `.env`:

   ```env
   VITE_SUPABASE_URL=https://supabase.dincouture.pk
   VITE_SUPABASE_ANON_KEY=<paste the key you copied>
   ```

3. **Restart the dev server** (stop and run `npm run dev` again) so the new env is picked up.

4. **Try login again** with:
   - **ndm313@yahoo.com** or **ndm313@live.com** → password: **123456**
   - **Admin** → **AdminDincouture2026**
   - **Demo** → **demo123**

## If you still get 401

- Confirm there are **no spaces** around the `=` or the key in `.env`.
- Try in an **Incognito** window so no old session/key is cached.
- On the VPS, check that Auth is up:  
  `ssh dincouture-vps "docker ps | grep auth"`

## Production (https://erp.dincouture.pk)

After deploy, the ERP container uses `.env.production` on the VPS (with the synced Kong key). If production login still fails, redeploy so the container gets the latest key:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/deploy.sh"
```
