# Self-Hosted Supabase Studio – What’s Different from Cloud

Self-hosted Studio (e.g. https://supabase.dincouture.pk) is the same app as Cloud Studio, but some **platform features** only work on Supabase Cloud. Below is what you’ll see as “missing” and how we handle it.

---

## 1. Home Page – Real-Time Metrics (Database / Auth / Storage / Realtime)

**What you see on Cloud:** Request counts and graphs for Database, Auth, Storage, Realtime.

**On self-hosted:** Often “No data to show” or zeros.

**Reason:** Those metrics come from Supabase’s cloud telemetry and Metrics API. Self-hosted doesn’t send data there. You can run the **Logflare (analytics)** container and point Studio at it, but the dashboard still isn’t the same as Cloud. For production, people usually add **Grafana + Prometheus** (or similar) for their own metrics.

**What we do:** No code change in your app. This is a platform limitation. Optionally you can enable/configure the analytics container and Postgres backend (see [Supabase self-hosting analytics](https://supabase.com/docs/guides/self-hosting/analytics/config)).

---

## 2. Database Backups

**What you see on Cloud:** Platform → Backups (scheduled backups, point-in-time recovery).

**On self-hosted:** **Backup option Studio UI mein kabhi nahi aayega** — ye Cloud-only feature hai. Self-hosted Studio (supabase.dincouture.pk) ke Platform section mein sirf Migrations, Wrappers, Webhooks hote hain; Backup menu nahi hota.

**What we do:** We added a **database backup script** so you can automate backups on the VPS:

- **Script:** `deploy/backup-supabase-db.sh`
- **Usage on VPS:**
  ```bash
  cd /root/NEWPOSV3
  bash deploy/backup-supabase-db.sh 7
  ```
  - Creates a dump in `./backups/supabase_db_YYYYMMDD_HHMMSS.dump`.
  - Last argument is retention in days (default 7); older dumps are deleted.

- **Daily cron (optional):**
  ```bash
  0 2 * * * cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 14
  ```
  (Runs at 2 AM, keeps 14 days.)

**Restore (if needed):**
```bash
docker exec -i supabase-db pg_restore -U postgres -d postgres -c --if-exists < backups/supabase_db_YYYYMMDD_HHMMSS.dump
```
(Use with care; `-c` drops objects before restore.)

**Note:** This backs up the **database only**. Storage files (buckets) are on disk (e.g. `volumes/storage`); back those up separately (e.g. rsync or your backup tool).

**Backup link in Studio:** A **floating “Backups” link** is injected at the **bottom-left** of Studio (https://supabase.dincouture.pk). It does not sit in the sidebar (that would break React hydration and cause “Host is not supported” / tables not loading). Click it to open the backup page. Direct URL: https://supabase.dincouture.pk/backup

---

## 3. Authentication Page – “Missing” Items

**What you see on Cloud:** Many Auth sub-menus (Users, OAuth Apps, Email, Policies, Sign In/Providers, Sessions, Rate Limits, MFA, URL Configuration, etc.).

**On self-hosted:** Often only **Users** and **Policies**. Other options (Sign In/Providers, Sessions, Rate Limits, MFA, etc.) are either in a different place or not shown in the same way.

**Reason:** Some Auth configuration on Cloud is done in the dashboard; on self-hosted the same behaviour is driven by **environment variables** for GoTrue (Auth). So the “missing” items are often “configured via .env instead of UI”.

**What you can do:**

- **OAuth / Sign In providers:** Set in Supabase `.env`, e.g.:
  - `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`
  - `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=...`
  - `GOTRUE_EXTERNAL_GOOGLE_SECRET=...`
  - (and similar for other providers).
- **URL / redirects:** Already set by our scripts (e.g. `SITE_URL`, `ADDITIONAL_REDIRECT_URLS`, `API_EXTERNAL_URL` in `fix-supabase-kong-domain.sh`).
- **Empty columns (Display name, Phone, Provider type):** That’s **user data** – users haven’t filled those fields. You can fill them in the Users table or via your app’s profile flow. Not a bug.

So “Authentication page par kafi cheez missing” is partly **fewer menus** (by design on self-hosted) and partly **empty optional fields** (data). The important parts (users, policies, auth working) are there; the rest is env-based config and optional data.

---

## Summary

| Feature              | Cloud                    | Self-hosted (our setup)                    |
|----------------------|--------------------------|--------------------------------------------|
| Home metrics/graphs  | Yes                      | No (use Grafana or accept “No data”)      |
| Database backups     | Platform UI + automated  | No UI; use `deploy/backup-supabase-db.sh`  |
| Auth config UI       | Full UI                  | Users + Policies; rest via .env            |
| Storage backups      | Included in platform     | Back up `volumes/storage` yourself         |

We’ve added the **backup script** and this doc so you can run backups and know why some Studio items look “missing” compared to Cloud.
