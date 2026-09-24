# DIN Couture ERP Backup & Recovery — Implementation Summary

**Date:** 2026-09-24  
**Repository:** `NDM0313/NEWPOSV3`  
**Purpose:** Record the ERP backup, verification, off-site copy, local-office copy, retention, safety controls, and current operational status implemented during the September 2026 VPS maintenance work.

> This document contains **no credentials or secrets**. Backblaze keys, Restic passwords, and other sensitive values must never be committed to Git.

---

## 1. Final backup architecture

The ERP now has three independent recovery layers:

```text
Production ERP / PostgreSQL
        |
        | daily verified dump
        v
VPS short-term backup
/root/backups/erp-db/
        |
        | encrypted Restic upload
        v
Backblaze B2 off-site storage
din-couture-erp-backups
        |
        +------------------------------+
                                       |
Office PC copy                         |
D:\ERP BACKUP                         |
                                       |
Result: VPS + external cloud + office PC
```

Current overall state:

- Production business DB: healthy
- VPS verified backup: active
- Office-PC backup: active and verified
- Backblaze B2 encrypted off-site backup: active and verified
- First B2 snapshot: `aa4ca74a`
- First B2 snapshot verification: PASS
- Restic repository check: PASS
- Daily automation: enabled
- Database mutations during backup implementation: none
- Production data deleted by backup implementation: none

The 3-2-1 architecture is operationally complete. The only remaining operational proof is to observe **two successful scheduled B2 runs** after the initial manual verified snapshot.

---

## 2. Protected business database

The primary protected ERP/business database is:

```text
postgres
```

At the time of verification it was approximately:

```text
294 MB
```

The backup work treats the entire `postgres` database as protected business data.

Important safety rule:

- Never perform a production DB mutation as part of backup verification.
- Restore testing must use a scratch/test database, never overwrite production directly.
- Every destructive maintenance task must be gated by a fresh verified backup.

---

## 3. Initial safety backup before cleanup work

Before any database/storage cleanup, a broad safety backup was completed to the office PC.

Historical backup root:

```text
D:\DIN_BACKUPS\DIN_COUTURE_VPS\2026-09-24
```

This safety set included:

- Full `postgres` custom-format dump
- PostgreSQL globals SQL
- Five staging DB dumps that existed at that time
- `_supabase` analytics database dump
- Supabase Storage filesystem archive
- SHA256 checksums
- Restore/list validation evidence

Important verified items included:

- Business dump:
  - `postgres_20260924T081131Z.dump`
  - approximately 23 MB
  - `pg_restore -l` PASS
  - SHA256 matched
- `_supabase` analytics dump:
  - approximately 1.47 GB
  - binary-safe streamed directly to office PC
  - `pg_restore` verification PASS
  - SHA256 matched
- Supabase Storage archive:
  - approximately 4.37 GB
  - streamed directly to office PC
  - archive verified
  - SHA256 matched

This backup gate was completed before the subsequent controlled cleanup work.

---

## 4. VPS daily ERP backup

Canonical VPS backup root:

```text
/root/backups/erp-db/
```

Daily backup script:

```text
/root/supabase-maintenance/business-db-backup.sh
```

Cron definition:

```text
/etc/cron.d/din-erp-backup
```

Schedule:

```text
0 21 * * *
```

This is **21:00 UTC = 02:00 PKT**.

Daily sequence:

1. Create custom-format `pg_dump` of the `postgres` business DB.
2. Create PostgreSQL globals backup.
3. Validate dump using `pg_restore -l`.
4. Generate and verify SHA256 checksums.
5. Write backup status metadata.
6. Keep the verified VPS copy.
7. Send the verified backup set to the encrypted Restic cloud stage.
8. Apply retention only after successful verification rules are satisfied.

Verified backup example:

```text
/root/backups/erp-db/2026/09/24
stamp: 20260924T115644Z
```

Verification for that set:

- SHA256: PASS
- `pg_restore -l`: PASS
- TOC entries: 3485
- `verified=true`

VPS short-term retention:

```text
7 verified backup days
```

The cloud stage is not allowed to delete the current verified day merely because the cloud upload fails.

---

## 5. Office-PC backup

The canonical office backup root was standardized to:

```text
D:\ERP BACKUP
```

Folder structure:

```text
D:\ERP BACKUP\
  YYYY\MM\DD\
    postgres_*.dump
    globals_*.sql
    SHA256SUMS.txt
    BACKUP_STATUS.json
    *.toc.txt

  logs\
  reports\
```

First verified standardized office pull:

```text
D:\ERP BACKUP\2026\09\24\postgres_20260924T115644Z.dump
```

Size:

```text
24,144,609 bytes (~23 MB)
```

Verification:

- SHA256 match: YES
- local `pg_restore -l`: PASS
- partial files left behind: 0

Office retention policy:

```text
30 daily
12 weekly
12 monthly
```

At the time of this implementation the office retention is **REPORT ONLY**; it does not automatically delete old files.

Example retention report location:

```text
D:\ERP BACKUP\reports\retention-candidates-20260924.txt
```

---

## 6. Office-side ERP helper files

The backup helper scripts were initially created under `AutoUploadAi`, which was the wrong logical project location.

They were moved/re-created under the ERP repository workspace:

```text
C:\Users\ndm31\dev\Corusr\NEW POSV3
```

Canonical local helper paths:

```text
scripts\ops\backup\push-b2-credentials-to-vps.ps1
scripts\ops\backup\pull-din-erp-backups.ps1
DIN-ERP-Backup.bat
docs\ops\DIN_ERP_BACKUP_AND_RESTORE_RUNBOOK.md
```

One-click office launcher:

```text
D:\ERP BACKUP\DIN-ERP-Backup.bat
```

The helper scripts were verified for Windows PowerShell 5.1 parsing.

The old AutoUploadAi copies were compared and removed after the NEWPOSV3 copies were verified.

As of the final housekeeping report, these NEWPOSV3 backup helper files existed locally but were still **untracked** and had not yet been committed together with unrelated application changes.

---

## 7. Backblaze B2 off-site backup

External provider:

```text
Backblaze B2
```

Bucket:

```text
din-couture-erp-backups
```

S3 endpoint:

```text
https://s3.us-east-005.backblazeb2.com
```

Restic repository:

```text
s3:https://s3.us-east-005.backblazeb2.com/din-couture-erp-backups
```

Bucket is private.

A bucket-scoped Application Key is used with the permissions needed for Restic backup and retention operations.

Secrets are stored only on the VPS and are not committed to Git.

Active credential environment file:

```text
/root/.config/din-erp-backup/restic-b2.env
```

Required permissions:

```text
root:root
0600
```

Restic password file:

```text
/root/.config/din-erp-backup/restic.password
```

The local same-VPS Restic repository also still exists:

```text
/root/backups/erp-restic-repo
```

It is intentionally retained until at least **two scheduled B2 backups** succeed after the initial manual B2 snapshot.

---

## 8. B2 credential helper bug and fix

The first credential helper attempt hit a Windows-to-Linux line-ending problem.

Observed failure:

```text
bash: line 2: syntax error near unexpected token '$'do\r''
```

Root cause:

- Windows PowerShell 5.1 sent CRLF multi-line shell content to Linux.
- A later attempted `tr -d "\r"` normalization was incorrectly quoted by the shell and removed the letter `r`, corrupting the environment file.

The corrupted file was quarantined, not reused.

The helper was then corrected to use:

- LF-only environment content
- safe uploaded LF-only verification script
- Python-based CR stripping rather than the broken `tr` path
- no secret echoing
- Windows PowerShell 5.1 compatible quoting

After the active B2 credentials and repository were proven healthy, the known corrupted quarantine file was removed.

---

## 9. First successful encrypted B2 snapshot

After recreating a valid Backblaze Application Key, authentication and bucket permissions passed.

Verified state:

```text
AUTHENTICATION_PASS: YES
PERMISSION_PASS: YES
B2_REPOSITORY_REACHABLE: YES
B2_REPOSITORY_INITIALIZED: YES
```

First encrypted off-site snapshot:

```text
aa4ca74a
```

Backup source:

```text
/root/backups/erp-db/2026/09/24
stamp: 20260924T115644Z
```

The snapshot was verified to contain:

- `postgres_*.dump`
- `globals_*.sql`
- `SHA256SUMS.txt`
- `BACKUP_STATUS.json`

Snapshot verification:

```text
PASS
```

Restic repository check:

```text
PASS
```

The reported Restic check completed without errors and checked a 5% data subset.

---

## 10. Cloud retention

Configured Restic cloud retention:

```text
--keep-daily 14
--keep-weekly 4
--keep-monthly 2
```

The retention rule is part of:

```text
erp-cloud-upload.sh
```

Safety rule:

Cloud forget/prune must run only when:

1. the new snapshot succeeded,
2. the snapshot is visible,
3. repository validation succeeded.

If the cloud upload fails:

- keep the verified VPS dump,
- do not remove existing B2 snapshots,
- do not affect ERP production,
- report the cloud failure.

The first manual B2 validation did **not** unnecessarily prune the new repository.

---

## 11. Daily cloud automation

Current cloud automation flow:

```text
02:00 PKT
    |
    v
business-db-backup.sh
    |
    +--> pg_dump postgres
    +--> pg_restore verification
    +--> globals backup
    +--> SHA256 validation
    +--> verified VPS backup
    |
    v
erp-cloud-upload.sh
    |
    v
Backblaze B2 encrypted Restic snapshot
```

Cron:

```text
0 21 * * *
```

Cloud status evidence should include:

```text
last_cloud_backend.txt = b2
last_cloud_rc.txt = 0
last_cloud_ok.txt = timestamp close to scheduled run
```

The cloud failure path was reviewed and confirmed to keep the local verified backup.

---

## 12. Scheduled-run proof gate

At the end of the implementation session:

```text
SUCCESSFUL_B2_SNAPSHOT_COUNT: 1
```

That snapshot is the manually initiated and verified snapshot:

```text
aa4ca74a
```

The local same-VPS Restic repository must remain until two successful scheduled B2 runs occur.

Expected validation after the next two scheduled runs:

```text
restic snapshots count >= 3 total

aa4ca74a
+ scheduled B2 snapshot #1
+ scheduled B2 snapshot #2
```

Also verify for both scheduled windows:

```text
last_cloud_backend.txt = b2
last_cloud_rc.txt = 0
last_cloud_ok.txt = matching scheduled timestamp
```

Until this gate passes:

```text
LOCAL_RESTIC_REMOVAL_ALLOWED: NO
```

---

## 13. Safe verification commands

These are examples only. Never print credential values.

Check the VPS daily backup directories:

```bash
ls -lah /root/backups/erp-db/
```

Check backup cron:

```bash
cat /etc/cron.d/din-erp-backup
```

Check active B2 credential file permissions without printing contents:

```bash
stat -c '%U:%G %a %n' /root/.config/din-erp-backup/restic-b2.env
```

Check production DB container health:

```bash
docker ps --filter name=supabase-db
```

For Restic operations, load the secure B2 environment without echoing it, then use the existing operational scripts rather than manually copying secrets into commands.

---

## 14. Restore principles

A backup is not considered trustworthy merely because the file exists.

Required restore safety approach:

1. Verify SHA256.
2. Run `pg_restore -l` against the custom-format dump.
3. Restore to a scratch/test database first.
4. Validate expected schema/tables/data.
5. Never overwrite production directly as a first restore test.
6. Keep the current production database untouched until the restore has been proven.
7. Record the exact backup stamp and snapshot ID used for any recovery.

The current verified restore evidence is based on dump-list validation and the backup verification pipeline; production was never replaced during this work.

---

## 15. Backup-related safety rules established

The following operating rules were adopted:

- No broad destructive Docker prune commands.
- No `docker system prune -a --volumes`.
- No mass database cleanup without a fresh verified backup.
- No production DB mutation just to test backup automation.
- No secrets in Git, chat logs, or committed environment examples.
- B2 credential file stays root-owned with mode 600.
- Office transfer uses partial-file handling so incomplete transfers are not mistaken for valid backups.
- SHA256 and `pg_restore -l` are both used as backup quality gates.
- Cloud retention is conditional on successful new backup verification.
- The same-VPS Restic repository is not considered true off-site storage.
- Self-hosted Supabase on the same VPS is not considered a separate disaster-recovery location.

---

## 16. What counts as the 3-2-1 set

Current copies:

### Copy 1 — Production/VPS side

```text
Live postgres DB
+
/root/backups/erp-db/
```

### Copy 2 — External cloud

```text
Backblaze B2
bucket: din-couture-erp-backups
encrypted by Restic
```

### Copy 3 — Office PC

```text
D:\ERP BACKUP
```

This gives separate media/locations and a true off-site copy.

---

## 17. Current status snapshot

As of 2026-09-24:

```text
VPS_BACKUP_STATUS: PASS
OFFICE_BACKUP_STATUS: PASS
B2_AUTHENTICATION: PASS
B2_PERMISSION: PASS
B2_REPOSITORY: PASS
FIRST_B2_SNAPSHOT: aa4ca74a
B2_SNAPSHOT_VERIFY: PASS
B2_RESTIC_CHECK: PASS
CLOUD_AUTOMATION_ENABLED: YES
CLOUD_RETENTION: 14 daily / 4 weekly / 2 monthly
TRUE_EXTERNAL_CLOUD_BACKUP: YES
3_2_1_ARCHITECTURE: COMPLETE
SCHEDULED_B2_RUNS_PROVEN: 0 of 2 required post-manual runs
LOCAL_VPS_RESTIC_RETAINED: YES
LOCAL_RESTIC_REMOVAL_ALLOWED: NO
POSTGRES_BUSINESS_DB_HEALTH: HEALTHY
ERP_HEALTH: OK
DATABASE_MUTATIONS: NONE
PRODUCTION_DATA_DELETED: NONE
```

---

## 18. Remaining follow-up

The next operational check is not another configuration change.

Allow the normal 02:00 PKT cron to run, then verify two scheduled B2 successes.

Only after both scheduled runs are proven should the old local same-VPS Restic repository be considered for removal.

Before any removal:

- confirm B2 snapshot count and dates,
- confirm both scheduled result files show success,
- confirm office backup remains healthy,
- confirm latest VPS dump verifies,
- estimate local Restic repository size,
- document rollback/recovery implications.

If the original failed Backblaze Application Key still exists in the Backblaze dashboard, it is safe to revoke **only after confirming the working key remains active**.

---

## 19. Key paths reference

```text
VPS business backup script:
/root/supabase-maintenance/business-db-backup.sh

VPS backup cron:
/etc/cron.d/din-erp-backup

VPS verified backups:
/root/backups/erp-db/

B2 credentials:
/root/.config/din-erp-backup/restic-b2.env

Restic password:
/root/.config/din-erp-backup/restic.password

Old local same-VPS Restic repo:
/root/backups/erp-restic-repo

Office backup:
D:\ERP BACKUP

Local ERP repo:
C:\Users\ndm31\dev\Corusr\NEW POSV3

Local helper scripts:
scripts\ops\backup\push-b2-credentials-to-vps.ps1
scripts\ops\backup\pull-din-erp-backups.ps1

Local restore runbook:
docs\ops\DIN_ERP_BACKUP_AND_RESTORE_RUNBOOK.md

One-click launcher:
DIN-ERP-Backup.bat
```

---

## 20. Operational verdict

```text
BACKUP_IMPLEMENTATION: PASS
TRUE_OFFSITE_BACKUP: PASS
OFFICE_BACKUP: PASS
VPS_BACKUP: PASS
FIRST_B2_ENCRYPTED_SNAPSHOT: PASS
SCHEDULED_AUTOMATION_CONFIGURATION: PASS
TWO_SCHEDULED_RUN_PROOF: PENDING
PRODUCTION_SAFETY: PASS
```

The ERP backup architecture should now be treated as a protected production control. Future changes to backup scripts, credentials, retention, restore logic, or storage locations should be made through the same staged process:

```text
read-only audit
-> exact plan
-> fresh verified backup
-> minimal change
-> verification
-> evidence
```
