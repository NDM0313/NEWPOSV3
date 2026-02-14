# Solo Go-Live Checklist

**Operator:** You only. No Slack/Teams/email.

---

## Pre-Flight

- [ ] **Domain OK**  
  `dig +short erp.dincouture.pk` → returns VPS IP

- [ ] **TLS OK**  
  `curl -sI https://erp.dincouture.pk | head -1` → `HTTP/2 200`

- [ ] **Backup OK**  
  `ls -la /opt/erp/supabase/backups/*.gz` → at least one non-zero file

- [ ] **RLS OK**  
  Run in Supabase SQL Editor:
  ```sql
  SELECT relname, relforcerowsecurity FROM pg_class
  WHERE relname IN ('purchases','rentals','expenses');
  ```
  → `relforcerowsecurity = true` for all three

- [ ] **No public DB ports**  
  `sudo ufw status` → only 22, 80, 443 allowed (no 5432)

---

## Smoke Tests

- [ ] **Home loads**  
  Open https://erp.dincouture.pk in browser → login page or app loads

- [ ] **Login works**  
  Login with test user → dashboard visible

- [ ] **Purchases list**  
  Navigate to Purchases → list loads (or empty)

- [ ] **Expenses list**  
  Navigate to Expenses → list loads (or empty)

---

## Monitoring

- [ ] **Logs accessible**  
  `docker logs -f erp-frontend` (or `journalctl -u erp-frontend -f`) → no crash loop

- [ ] **Backup cron**  
  `crontab -l` → contains `deploy/supabase-backup.sh` (daily)

---

## One-Liner Verification

```bash
dig +short erp.dincouture.pk && \
curl -sI https://erp.dincouture.pk | head -1 && \
ls /opt/erp/supabase/backups/*.gz 2>/dev/null | head -1 && \
sudo ufw status | grep -E "22|80|443"
```
