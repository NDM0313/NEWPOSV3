# Phase 2.9A — Preview redeploy (compare fix)

**Date:** 2026-06-25  
**Status:** `PHASE 2.9A PREVIEW REDEPLOYED @ 5b520cef — operator browser QA`

## What ran

- `/root/NEWPOSV3-preview-qa` reset to `5b520cef` (`4880a966` + `5b520cef` compare fixes)
- `deploy/write-erp-env-from-supabase-docker-env.sh` (read-only env)
- `docker compose` build `erp-frontend-preview:latest` — **SUCCESS**
- `docker run -p 3003:80` — **SUCCESS** (3002 occupied by `erp-mobile`)

## Access

```bash
ssh -N -L 3002:127.0.0.1:3003 dincouture-vps
# http://localhost:3002
```

## Bundle verify

| String | Status |
|--------|--------|
| Unified engine preview | FOUND |
| Load MR JALIL | FOUND |
| phase2-compare-ledger-v2 | FOUND |
| unified-ledger-tieout | FOUND |

HTTP `127.0.0.1:3003/` → **200 OK**

## Not run

- `deploy/deploy.sh`, migrations, RLS, `feature_flags` writes
- Production `erp-frontend` (:3001) — **unchanged**

## Operator next

1. Admin Compare — Party MR JALIL + Pilot Batch 9/9
2. TB with **official_gl** basis
3. Cash/Bank re-export JSON — expect row-key matches

**Stage 1 SQL:** still blocked until interactive QA PASS.
