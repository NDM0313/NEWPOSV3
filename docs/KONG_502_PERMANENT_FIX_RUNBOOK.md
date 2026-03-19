# Kong 502 Permanent Fix Runbook

**Saari auth/Kong docs ek jagah:** **`docs/MASTER_AUTH_AND_KONG_RUNBOOK.md`** – 502, 401, office/ghar, console errors sab ka index.

**Scope:** Self-hosted Supabase on VPS. When `supabase.dincouture.pk` returns **502 Bad Gateway** on `/auth/v1/*` and `/rest/v1/*` because Kong is in a restart loop due to malformed `kong.yml`.

---

## 1. Problem summary

| Symptom | Cause |
|--------|--------|
| `supabase-kong` in restart loop | Kong fails to start |
| `/auth/v1/health`, `/rest/v1/` return 502 | Kong not running; Traefik has no upstream |
| Kong logs: `failed parsing declarative configuration: 166:27: did not find expected key` | Invalid YAML in `kong.yml` |

**Root cause:** In `/root/supabase/docker/volumes/api/kong.yml`, the CORS plugin block is malformed: `config:` (and its children) is placed as a **sibling** of the `plugins:` list—either same indent as `- name: cors` or *less* (e.g. same as `plugins:`). Kong then fails with "did not find expected key".

This is not local drift; both office and home hit the same live gateway. The fix is applied on the VPS to the live `kong.yml`.

---

## 2. Standard recovery command

From your machine (one command):

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh"
```

On the VPS:

```bash
cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh
```

This will:

1. Backup `kong.yml` to `kong.yml.bak-YYYYMMDD-HHMMSS`
2. Detect and remove all malformed CORS `config:` blocks (idempotent)
3. Restart Kong
4. Wait 30s and verify container status + auth/rest health
5. Print clear success/warning and rollback hint

---

## 3. Repo files (permanent fix)

| File | Purpose |
|------|--------|
| `deploy/kong-doctor.sh` | Diagnostics only. Shows Kong status, last logs, and whether `kong.yml` has misplaced CORS blocks. No modifications. |
| `deploy/fix-kong-cors-yaml.py` | Fixes malformed CORS blocks in place (config at same or *less* indent than `- name: cors`). `--check-only` reports only. Idempotent. |
| `deploy/kong-safe-repair.sh` | Full recovery: backup → fix → restart → verify. Use this for standard recovery. |
| `deploy/kong-auto-repair-if-needed.sh` | For cron: runs `kong-safe-repair.sh` only when Kong is in Restarting state. No-op when healthy. |
| `docs/KONG_502_PERMANENT_FIX_RUNBOOK.md` | This runbook. |

---

## 4. When to run what

- **502 on auth/rest, Kong restart loop**  
  → Run **kong-safe-repair.sh** (standard recovery).

- **Check if Kong is broken or if kong.yml has the bad pattern (no changes)**  
  → Run **kong-doctor.sh**.

- **Only fix kong.yml (no backup/restart here; use repair for full flow)**  
  → `python3 deploy/fix-kong-cors-yaml.py /root/supabase/docker/volumes/api/kong.yml`  
  (Repair script does backup + this + restart + verify.)

---

## 5. Verification after repair

- **Container:**  
  `docker ps --format "table {{.Names}}\t{{.Status}}" | grep kong`  
  Expect: `supabase-kong   Up N seconds (healthy)`.

- **Auth health (from VPS):**  
  `source /root/supabase/docker/.env && curl -sS -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" https://supabase.dincouture.pk/auth/v1/health`  
  Expect: `200`.

- **Rest (from VPS):**  
  `curl -sS -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" -H "Accept: application/json" https://supabase.dincouture.pk/rest/v1/`  
  Expect: `200` or `406`.

- **Browser:** Open https://erp.dincouture.pk and log in; no 502 on auth/rest.

---

## 6. Rollback

If something goes wrong after repair:

```bash
# On VPS
cp /root/supabase/docker/volumes/api/kong.yml.bak-YYYYMMDD-HHMMSS /root/supabase/docker/volumes/api/kong.yml
cd /root/supabase/docker && docker compose restart kong
```

Use the backup filename printed by `kong-safe-repair.sh`.

---

## 7. Ensuring scripts exist on VPS

Scripts live in the repo. After push, on VPS:

```bash
cd /root/NEWPOSV3 && git pull
```

Then run the standard recovery command. If the repo is not yet updated on VPS, copy from your machine:

```bash
scp deploy/kong-doctor.sh deploy/fix-kong-cors-yaml.py deploy/kong-safe-repair.sh dincouture-vps:/root/NEWPOSV3/deploy/
```

---

## 8. Auto-repair (cron on VPS)

On the VPS, a cron job runs every 5 minutes:

- **`/root/NEWPOSV3/deploy/kong-auto-repair-if-needed.sh`**  
  If Kong is in **Restarting** state, it runs `kong-safe-repair.sh` (backup, fix, restart, verify). If Kong is Up/healthy, it does nothing. Log: `/var/log/kong-auto-repair.log`.

So if `kong.yml` is broken again (e.g. after a config change or deploy), Kong will be repaired within about 5 minutes without manual SSH.

---

## 9. Idempotency

- **fix-kong-cors-yaml.py:** Running it again after a successful fix leaves `kong.yml` unchanged (no duplicate removals).
- **kong-safe-repair.sh:** Safe to run multiple times: backup is always taken; fix is no-op if no misplaced blocks; restart and verify are safe to repeat.

---

## 10. Summary

| Item | Detail |
|------|--------|
| **Root cause** | Malformed YAML: `config:` sibling of `- name: cors` in `kong.yml`. |
| **Fix** | Remove those misplaced CORS `config:` blocks; keep `- name: cors` only. |
| **Standard recovery** | `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh"` |
| **Diagnostics only** | `bash deploy/kong-doctor.sh` |
| **Rollback** | Restore `kong.yml` from printed backup path and restart Kong. |
