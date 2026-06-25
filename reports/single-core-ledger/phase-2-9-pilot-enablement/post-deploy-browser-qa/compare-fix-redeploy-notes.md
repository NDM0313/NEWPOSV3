# Phase 2.9A — Preview redeploy (compare fix)

**Date:** 2026-06-25  
**Status:** `PHASE 2.9A PREVIEW REDEPLOYED @ 18a798a3 — operator browser QA`

## What ran

- `/root/NEWPOSV3-preview-qa` reset to `18a798a3` (Cash/Bank pass = row parity + period movement)
- `deploy/write-erp-env-from-supabase-docker-env.sh` (read-only env)
- `docker compose` build `erp-frontend-preview:latest` — **SUCCESS**
- `docker run -p 3003:80` — **SUCCESS** (3002 occupied by `erp-mobile`; compose up failed on network prune — manual run OK)

## Access

```bash
ssh -N -L 3002:127.0.0.1:3003 dincouture-vps
# http://localhost:3002
```

## Bundle verify

| String | Status |
|--------|--------|
| Unified engine preview | FOUND (prior) |
| roznamchaCashBankCompareMappers-BV9zJ3Nr.js | FOUND (new chunk @ 18a798a3) |
| periodMovementPass / rowParityPass | FOUND in source map |

HTTP `127.0.0.1:3003/` → **200 OK**

## Not run

- `deploy/deploy.sh`, migrations, RLS, `feature_flags` writes
- Production `erp-frontend` (:3001) — **unchanged**

## Operator next

1. Admin Compare — Cash/Bank DIN CHINA (All + Bank) — expect **PASS** when row diff clean (0 missing/extra/mismatch)
2. Closing totals may still differ (informational); PASS no longer requires closing match
3. Party MR JALIL + Pilot Batch 9/9 + TB official_gl (already PASS)

**Stage 1 SQL:** still blocked until interactive QA PASS on all compare tabs.
