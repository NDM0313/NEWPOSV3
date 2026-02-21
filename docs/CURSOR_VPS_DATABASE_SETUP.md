# Cursor → VPS Database Connection Setup

**TL;DR:** `.env.local` me `DATABASE_URL` = VPS DB (direct ya SSH tunnel), `VITE_SUPABASE_URL` = VPS Kong URL. Migrations: `node scripts/run-migrations.js`. Cloud DB freeze – naya migration wahan mat chalao.

---

## Current vs Target Architecture

| Component | Current | Target |
|-----------|---------|--------|
| **Mobile** | VPS Supabase ✅ | VPS Supabase ✅ |
| **Web (prod)** | VPS Supabase ✅ | VPS Supabase ✅ |
| **Cursor / Dev** | Supabase Cloud ⚠️ | **VPS Supabase** ✅ |
| **Supabase Cloud** | Active | **Frozen / Backup** |

**Goal:** Single source of truth = VPS. Cursor ko VPS DB se connect karo.

---

## STEP 1 – VPS Connection Details

Aap ke VPS references (docs se):

- **Kong API URL:** `https://erp.dincouture.pk` ya `https://supabase.dincouture.pk`
- **Direct IP:** `72.62.254.176:8443` (agar domain na ho)
- **PostgreSQL:** Typically `localhost:5432` on VPS (expose mat karo public)

---

## STEP 2 – Cursor Ko VPS DB Se Connect Karna

### Option A – Direct PostgreSQL (Port 5432 = Pooler)

VPS par port 5432 Supabase **pooler** (Supavisor) pe map hai. Username format: `postgres.TENANT_ID` (e.g. `postgres.your-tenant-id`).

`.env.local` me:

```env
# VPS = MAIN DATABASE (pooler format: postgres.TENANT_ID)
# POOLER_TENANT_ID from /root/supabase/docker/.env use karein
DATABASE_URL=postgresql://postgres.your-tenant-id:YOUR_VPS_DB_PASSWORD@72.62.254.176:5432/postgres

# Optional: Pooler URL (agar Supabase pooler use kar rahe ho)
# DATABASE_POOLER_URL=postgresql://postgres.xxx:password@...:6543/postgres

# Web dev ke liye (Vite) – VPS Supabase API
VITE_SUPABASE_URL=https://erp.dincouture.pk
VITE_SUPABASE_ANON_KEY=your_vps_anon_key

# Service role (scripts ke liye – NEVER commit)
SUPABASE_SERVICE_ROLE_KEY=your_vps_service_role_key
```

**Security:** Port 5432 sirf trusted IPs ke liye firewall me allow karein.

---

### Option B – SSH Tunnel (Recommended – More Secure)

1. **SSH tunnel start karo** (local terminal):

```bash
ssh -L 5433:localhost:5432 root@72.62.254.176
# Ya: ssh -L 5433:localhost:5432 user@erp.dincouture.pk
```

2. **Dusra terminal** – `.env.local`:

```env
# Localhost via tunnel – VPS DB
DATABASE_URL=postgresql://postgres:YOUR_VPS_DB_PASSWORD@localhost:5433/postgres

VITE_SUPABASE_URL=https://erp.dincouture.pk
VITE_SUPABASE_ANON_KEY=your_vps_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_vps_service_role_key
```

3. **Migrations run karo:**

```bash
node scripts/run-migrations.js
```

---

## STEP 3 – Cursor Supabase MCP (Optional)

Agar aap Cursor me Supabase MCP use kar rahe ho (migrations, SQL, etc.):

- MCP ko **VPS Supabase** se connect karna hoga.
- Cursor Settings → MCP → Supabase config me:
  - **Project URL:** `https://erp.dincouture.pk` (VPS Kong URL)
  - **Service Role Key:** VPS wala key

Agar MCP sirf Supabase Cloud support karta ho, to:
- Migrations: `DATABASE_URL` + `node scripts/run-migrations.js` use karo
- Manual SQL: `psql $DATABASE_URL` ya SSH tunnel + local client

---

## STEP 4 – Supabase Cloud Ko Freeze Karna

1. **Naya migration Cloud par mat chalao** – sirf VPS par.
2. **Cloud DB ko read-only** treat karein (optional: RLS / permissions).
3. **Backup:** Weekly `pg_dump` Cloud se le sakte ho (agar data preserve karna ho).

---

## STEP 5 – Migration Strategy

1. **Schema sync check:**

```bash
# VPS schema dump
pg_dump $DATABASE_URL --schema-only -f vps_schema.sql

# Cloud schema dump (agar Cloud URL hai)
pg_dump $CLOUD_DATABASE_URL --schema-only -f cloud_schema.sql

# Diff
diff vps_schema.sql cloud_schema.sql
```

2. **Agar VPS behind hai:** Latest migrations VPS par chalao:

```bash
# .env.local me DATABASE_URL = VPS
node scripts/run-migrations.js
```

3. **Golden rule:** Production (VPS) par hi future migrations chalti hain.

---

## STEP 6 – SSH Config (Professional)

`~/.ssh/config` me:

```
Host erp-vps
    HostName 72.62.254.176
    User root
    IdentityFile ~/.ssh/erp_deploy_key
```

Phir:

```bash
ssh -L 5433:localhost:5432 erp-vps
```

---

## Related Files

- **`.env.example`** – Template with VPS notes
- **`scripts/run-migrations.js`** – Uses `DATABASE_POOLER_URL` or `DATABASE_URL` from `.env.local`

---

## Checklist

- [ ] `.env.local` me `DATABASE_URL` = VPS (direct ya tunnel)
- [ ] `VITE_SUPABASE_URL` = VPS Kong URL
- [ ] `VITE_SUPABASE_ANON_KEY` = VPS anon key
- [ ] `node scripts/run-migrations.js` se migrations VPS par
- [ ] Cloud DB ko freeze – naya migration wahan mat chalao
- [ ] SSH key secure rakhein (repo me na dalen)

---

## Security Reminders

- `SUPABASE_SERVICE_ROLE_KEY` kabhi commit mat karo
- `.env.local` `.gitignore` me hona chahiye
- Production DB par risky query se pehle backup
- Port 5432 public expose na karein – SSH tunnel prefer karein
