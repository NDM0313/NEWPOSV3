# ERP container nahi chal raha – start karo

Agar `docker compose -f docker-compose.prod.yml ps` empty ho:

## 1) Start container

```bash
cd /root/NEWPOSV3
docker compose -f docker-compose.prod.yml up -d
```

Agar image nahi bani ho to pehle deploy script chalao (build + up):

```bash
cd /root/NEWPOSV3 && bash scripts/deploy-erp-vps.sh
```

## 2) Status check

```bash
docker compose -f docker-compose.prod.yml ps
```

"Up" dikhna chahiye.

## 3) Agar phir bhi empty ya Exited

Logs dekho (container kyun exit ho raha hai):

```bash
docker compose -f docker-compose.prod.yml logs --tail 50 erp-frontend
```

Agar "no such image" aaye to pehle build karo:

```bash
cd /root/NEWPOSV3
export VITE_SUPABASE_URL=https://erp.dincouture.pk
export VITE_SUPABASE_ANON_KEY=$(grep -E '^ANON_KEY=' /root/supabase/docker/.env | cut -d= -f2- | tr -d '"')
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```
