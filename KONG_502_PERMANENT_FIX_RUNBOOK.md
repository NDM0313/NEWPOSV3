# KONG 502 Permanent Fix Runbook

## Confirmed root cause
This issue is **not** local code drift between home and office.
The confirmed root cause is:
- `supabase-kong` restart loop
- Kong log error: `failed parsing declarative configuration: 166:27: did not find expected key`
- Invalid live file: `/root/supabase/docker/volumes/api/kong.yml`
- Misplaced `config:` block after `- name: cors`

That broken YAML causes public 502 responses on:
- `/auth/v1/health`
- `/rest/v1/`
- Supabase Studio frontend pages

## Standard repo files to add
Place these files in your repo:
- `deploy/kong-doctor.sh`
- `deploy/fix-kong-cors-yaml.py`
- `deploy/kong-safe-repair.sh`
- `docs/KONG_502_PERMANENT_FIX_RUNBOOK.md`

## Suggested `deploy/kong-doctor.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== git commit ==="
git rev-parse HEAD || true

echo "=== container status ==="
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'supabase-kong|supabase-auth|supabase-rest' || true

echo "=== recent Kong logs ==="
docker logs --tail=80 supabase-kong || true

echo "=== kong.yml suspicious section ==="
nl -ba /root/supabase/docker/volumes/api/kong.yml | sed -n '140,240p' || true

echo "=== public health ==="
curl -i https://supabase.dincouture.pk/auth/v1/health || true
curl -i https://supabase.dincouture.pk/rest/v1/ || true
```

## Standard recovery command
From any machine:
```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh"
```

## GitHub workflow
1. Add the repair files into the repo.
2. Commit and push from one machine.
3. Pull on office and home machines.
4. In future, do **not** manually edit live `kong.yml` unless absolutely necessary.
5. Use the standard recovery command only.

## Why this fixes the “home vs office” problem
Both office and home machines were hitting the same broken live gateway.
Once the fix lives in the repo and the recovery command is standardized, both machines use the same repair path instead of ad-hoc manual fixes.
