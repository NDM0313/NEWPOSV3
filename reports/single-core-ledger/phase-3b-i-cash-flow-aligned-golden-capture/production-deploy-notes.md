# Production deploy notes — Phase 3B-H-PROD

**Result:** SUCCESS  
**Target:** https://erp.dincouture.pk  
**Host:** `dincouture-vps`  
**Deployed commit:** `d2401b1f` — feat(accounting): align Cash Flow preview to finance rules

## Deploy command

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git fetch origin main && git pull origin main && bash deploy/vps-build-erp-only.sh"
```

## Timestamps

- **Start:** 2026-06-29 ~14:37 UTC
- **End:** 2026-06-29 ~14:40 UTC

## Container health

| Container | Status |
|-----------|--------|
| `erp-frontend` | Recreated and started |
| `erp-frontend-preview` | Up (unchanged) |

## Safety confirmation

| Action | Run? |
|--------|------|
| DB migrations | **NO** |
| Supabase migration apply | **NO** |
| Database container restart/modify | **NO** |
| Feature flag changes | **NO** |
| GL / accounting data mutations | **NO** |

Frontend-only ERP bundle deploy via `deploy/vps-build-erp-only.sh`.
