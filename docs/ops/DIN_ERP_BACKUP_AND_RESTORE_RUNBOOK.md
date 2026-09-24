# DIN Couture — ERP / business database 3-2-1 backup & restore runbook

**Database:** `postgres` (ERP + portal business data)  
**Host:** `dincouture-vps` / `srv1314836`  
**Never** auto-restore into production. Always test into a **new** database first.

---

## Backup layers (3-2-1)

| Layer | Where | Retention | Schedule |
|-------|--------|-----------|----------|
| 1 | VPS `/root/backups/erp-db/YYYY/MM/DD/` | 7 verified days | Daily **02:00 PKT** (21:00 UTC) |
| 2 | Encrypted **restic → Backblaze B2** `din-couture-erp-backups` | 14d / 4w / 2m | After each verified dump |
| 3 | Office PC **`D:\ERP BACKUP\`** | 30 daily / 12 weekly / 12 monthly (report-only deletes for now) | Double-click `DIN-ERP-Backup.bat` |

**B2 S3 endpoint:** `https://s3.us-east-005.backblazeb2.com`  
**Restic repo:** `s3:https://s3.us-east-005.backblazeb2.com/din-couture-erp-backups`  
**Credentials (VPS only, chmod 600):** `/root/.config/din-erp-backup/restic-b2.env`  
**Encryption password file:** `/root/.config/din-erp-backup/restic.password`

Same-VPS restic staging `/root/backups/erp-restic-repo` is **retained** until two successful scheduled B2 backups (do not delete yet).

### Install / refresh B2 credentials (secrets never in Git/chat)

Office PC (preferred) — from **NEWPOSV3** repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\ops\backup\push-b2-credentials-to-vps.ps1
```

Or on VPS with TTY:

```bash
ssh -t dincouture-vps /root/.config/din-erp-backup/install-b2-credentials.sh
```

Credentials live only on the VPS (`restic-b2.env`, chmod 600). Never commit them.

Logflare analytics retention is separate (`03:30 PKT`) and does **not** touch `postgres`.

---

## Canonical office location

```text
D:\ERP BACKUP\
  YYYY\MM\DD\
    postgres_<timestamp>.dump
    globals_<timestamp>.sql
    SHA256SUMS.txt
    BACKUP_STATUS.json
    postgres_<timestamp>.toc.txt
  logs\
  reports\
```

Do **not** use `D:\DIN_BACKUPS\DIN_COUTURE_ERP` for new ERP backups.

---

## A) How to run the one-click backup

1. Double-click **`DIN-ERP-Backup.bat`** in the **NEWPOSV3** repo root  
   — or —  
   Double-click **`D:\ERP BACKUP\DIN-ERP-Backup.bat`** (shortcut launcher → NEWPOSV3 scripts).
2. Wait for pull + SHA256 verify.
3. Expect: **`DIN ERP BACKUP PASS`**

Manual (from NEWPOSV3 repo root):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\ops\backup\pull-din-erp-backups.ps1
```

---

## B) How to find the latest verified backup

**Office PC**

```text
D:\ERP BACKUP\YYYY\MM\DD\
```

Open the newest date folder. Confirm `BACKUP_STATUS.json` has `"verified": true`.

**VPS**

```bash
cat /root/backups/erp-db/LATEST_VERIFIED.txt
ls "$(cat /root/backups/erp-db/LATEST_VERIFIED.txt)"
```

---

## C) How to verify SHA256 (office)

```powershell
cd "D:\ERP BACKUP\2026\09\24"   # example day
Get-Content .\SHA256SUMS.txt | ForEach-Object {
  if ($_ -match '^([a-fA-F0-9]{64})\s+(.+)$') {
    $e=$Matches[1].ToLower(); $f=$Matches[2].Trim()
    $g=(Get-FileHash $f -Algorithm SHA256).Hash.ToLower()
    "{0}  {1}" -f ($(if($e-eq$g){'OK'}else{'BAD'}), $f)
  }
}
```

If `pg_restore` is installed locally: `pg_restore -l postgres_*.dump` must list a TOC without error.

---

## D) Restore into a NEW scratch database (never production)

Example using VPS docker (scratch DB name only):

```bash
DUMP=/path/to/postgres_YYYYMMDDTHHMMSSZ.dump
docker cp "$DUMP" supabase-db:/tmp/restore.dump
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "CREATE DATABASE postgres_restore_scratch TEMPLATE template0;"
docker exec supabase-db pg_restore --no-owner --no-acl \
  -d postgres_restore_scratch /tmp/restore.dump
docker exec supabase-db rm -f /tmp/restore.dump
```

Validate tables in `postgres_restore_scratch`. Drop the scratch DB when done.

---

## E) Production restore requires explicit approval

- No automated cutover.
- Always take a **fresh** verified dump before any production restore window.
- Production restore/rename of live `postgres` needs a separate signed maintenance plan.

---

## What each verified backup contains

- `postgres_YYYYMMDDTHHMMSSZ.dump` — `pg_dump -Fc --no-owner --no-acl -d postgres`
- `globals_YYYYMMDDTHHMMSSZ.sql` — `pg_dumpall --globals-only`
- `SHA256SUMS.txt`
- `BACKUP_STATUS.json` (`verified: true` only after VPS `pg_restore -l` PASS)
- `postgres_*.toc.txt` — TOC from `pg_restore -l`

---

## VPS operations

```bash
/root/supabase-maintenance/business-db-backup.sh
tail -f /root/supabase-maintenance/logs/business-db-backup.log
cat /root/backups/erp-db/LATEST_VERIFIED.txt
```

Cron: `/etc/cron.d/din-erp-backup` (02:00 PKT)  
Restic (same VPS, retained): `/root/backups/erp-restic-repo`

---

## Disaster recovery summary

| Path | Source |
|------|--------|
| A | VPS `/root/backups/erp-db/...` |
| B | Office `D:\ERP BACKUP\...` |
| C | Restic restore from `/root/backups/erp-restic-repo` (same host until external cloud is configured) |

Always restore to a **new** database first.
