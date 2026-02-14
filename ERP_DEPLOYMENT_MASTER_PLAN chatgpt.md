# ERP Self-Hosted Deployment Master Plan

**Owner:** Nadeem Khan\
**Server:** 72.62.254.176\
**Domain:** erp.dincouture.pk\
**Date Generated:** 2026-02-14 15:06:34

------------------------------------------------------------------------

# CURRENT STATUS

## Completed

-   VPS active (8GB RAM)
-   Docker installed
-   Subdomain created (erp.dincouture.pk)
-   ERP frontend production build ready (v1.0.0)
-   Release discipline document created
-   Staging checklist created
-   Supabase self-host plan prepared

------------------------------------------------------------------------

# FINAL ARCHITECTURE DECISION

We will run everything on VPS:

Browser → Nginx (HTTPS) → Supabase Self-Hosted (Docker Stack) →
PostgreSQL (internal only) → ERP Frontend (dist build)

NO Supabase Cloud NO Public DB exposure NO Direct IP usage

------------------------------------------------------------------------

# PHASE 1 -- SERVER PREPARATION

1.  Secure firewall: Allow ports: 22, 80, 443 Block everything else

2.  Install:

    -   Docker
    -   Docker Compose
    -   Nginx
    -   Certbot (SSL)

------------------------------------------------------------------------

# PHASE 2 -- SUPABASE SELF HOST

1.  Clone official Supabase repo

2.  Configure .env with:

    -   JWT_SECRET
    -   ANON_KEY
    -   SERVICE_ROLE_KEY

3.  docker compose up -d

4.  Verify containers: supabase-db supabase-auth supabase-rest
    supabase-realtime supabase-storage kong studio

5.  Verify extensions: pgcrypto uuid-ossp pgjwt

------------------------------------------------------------------------

# PHASE 3 -- DATA MIGRATION (IF MOVING FROM CLOUD)

1.  Backup schema-only
2.  Backup data-only
3.  Restore order:
    -   Schema
    -   Functions
    -   Data
4.  Verify: pg_policies pg_proc

------------------------------------------------------------------------

# PHASE 4 -- FRONTEND DEPLOY

1.  Update .env.production: VITE_SUPABASE_URL=https://erp.dincouture.pk
    VITE_SUPABASE_ANON_KEY=`<NEW VPS KEY>`{=html}

2.  npm run build

3.  Upload dist/ to: /root/erp-production/frontend/

4.  Configure Nginx:

    -   Root → dist
    -   SPA fallback
    -   Gzip
    -   Security headers
    -   No directory listing

5.  Install SSL: Let's Encrypt Force HTTPS

------------------------------------------------------------------------

# PHASE 5 -- DRY RUN (MANDATORY)

Test:

-   Login
-   Sales create/edit/delete
-   Payment reverse
-   Rental cycle (booking → pickup → return)
-   Studio pipeline
-   Reports export
-   Multi-role RLS isolation

If all green → proceed to Cutover

------------------------------------------------------------------------

# PHASE 6 -- FINAL CUTOVER

1.  Final backup
2.  DNS verify
3.  Restart stack
4.  Monitor 48 hours

------------------------------------------------------------------------

# RESOURCE PLANNING (8GB RAM)

Supabase stack approx usage: - Postgres: 1.5--2GB - Auth + Realtime +
Rest: \~1GB - Nginx + Frontend: minimal - Remaining RAM safe for
automation

Safe for 8GB production ERP.

------------------------------------------------------------------------

# BACKUP STRATEGY

Daily cron job:

pg_dump -U postgres -d postgres \| gzip \> /backup/erp\_\$(date
+%F).sql.gz

------------------------------------------------------------------------

# SECURITY RULES

-   Never expose 5432 publicly
-   Never expose 8000 publicly
-   Use reverse proxy only
-   Use domain + SSL
-   Keep JWT_SECRET safe

------------------------------------------------------------------------

# WHAT REMAINS

-   Firewall enforcement
-   Supabase stack start
-   SSL activation
-   Dry run execution
-   Final cutover

------------------------------------------------------------------------

# FINAL STATUS

System ready for Phase 1 execution. Recommended next action: Start VPS
preparation and firewall lockdown.
