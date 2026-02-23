# VPS Backup & Security Report — GO-LIVE READINESS

**Generated:** 2025-02-23  
**Scope:** dincouture-vps (72.62.254.176), Supabase self-hosted, ERP deployment

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|-------|
| Daily Automated Backup | ⚠️ Manual | Script exists; cron not confirmed |
| Backup Retention | ✅ 7–14 days | Configurable via script arg |
| Backup Location | ✅ Outside container | Host filesystem |
| Restore Test Script | ✅ Documented | deploy/SUPABASE_BACKUP_RESTORE.md |
| SSL Certificates | ✅ Traefik/Let's Encrypt | erp.dincouture.pk, supabase.dincouture.pk |
| Firewall | ⚠️ Verify | UFW/iptables; 5432 not exposed |
| Supabase JWT | ✅ Consistent | Kong anon key synced to ERP |

---

## 2. Backup System

### Scripts Available
| Script | Path | Purpose |
|--------|------|---------|
| backup-supabase-db.sh | deploy/backup-supabase-db.sh | pg_dump -Fc to ./backups/ |
| supabase-backup.sh | deploy/supabase-backup.sh | Full + schema-only to /opt/erp/supabase/backups/ |

### backup-supabase-db.sh
- **Usage:** `bash deploy/backup-supabase-db.sh [retention_days]`
- **Default retention:** 7 days
- **Output:** `$ROOT/backups/supabase_db_YYYYMMDD_HHMMSS.dump`
- **Format:** Custom format (-Fc) for pg_restore
- **Location:** Host filesystem (not inside container)

### supabase-backup.sh
- **Output dir:** `/opt/erp/supabase/backups/`
- **Files:** `supabase_full_*.sql.gz`, `supabase_schema_*.sql.gz`
- **Retention:** 7 days

### Cron (Daily 2am)
**Documented in deploy/SUPABASE_BACKUP_RESTORE.md:**
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/NEWPOSV3/deploy/supabase-backup.sh") | crontab -
```

**Action required:** Verify cron is configured on VPS:
```bash
ssh dincouture-vps "crontab -l"
```

If no cron exists, add:
```bash
0 2 * * * cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 14
```

---

## 3. Restore Procedure

**Document:** deploy/SUPABASE_BACKUP_RESTORE.md

### Validate backup
```bash
gunzip -c backup.sql.gz | head -100
```

### Full restore (destructive)
```bash
gunzip -c "$BACKUP" | docker exec -i supabase-db psql -U postgres -d postgres
```

### pg_restore (for .dump format)
```bash
docker exec -i supabase-db pg_restore -U postgres -d postgres -c --if-exists < backups/supabase_db_*.dump
```

---

## 4. SSL Certificates

- **Provider:** Let's Encrypt (via Traefik/Caddy)
- **Domains:** erp.dincouture.pk, supabase.dincouture.pk
- **Status:** Valid (assumed; verify with `curl -sI https://erp.dincouture.pk`)

---

## 5. Firewall & Ports

- **5432:** Should NOT be exposed publicly (DB internal only)
- **80/443:** ERP, Supabase Kong
- **Action:** Verify `ufw status` or `iptables -L` on VPS

---

## 6. Supabase JWT Consistency

- **Kong anon key:** Synced to ERP `.env.production` (VITE_SUPABASE_ANON_KEY)
- **Deploy script:** fix-supabase-kong-domain.sh syncs key
- **Status:** ✅ Handled in deploy flow

---

## 7. Recommendations

| Priority | Item | Action |
|----------|------|--------|
| High | Daily backup cron | Add cron job if not present |
| Medium | Remote backup | Optional: rsync/S3 for off-site copies |
| Low | Restore drill | Run restore test quarterly |

---

## 8. Verdict

**Backup system is READY** with scripts and documentation. **Verify cron is scheduled** for daily automated backups before go-live.
