# Phase 2.9A-3 — VPS deploy execution notes

**Date:** 2026-06-25  
**Status:** `PHASE 2.9A-3 PREVIEW DEPLOY COMPLETE — ready for browser waiver QA`

## What ran

- Cloned `/root/NEWPOSV3-preview-qa` @ `20f72a90`
- `deploy/write-erp-env-from-supabase-docker-env.sh` (read prod env keys only)
- `docker compose` build `erp-frontend-preview:latest` — **SUCCESS**
- **No** `deploy/deploy.sh`, migrations, RLS, edge functions, or `feature_flags` SQL

## Port adjustment

| Planned | Actual | Reason |
|---------|--------|--------|
| 3002 | **3003** | `erp-mobile` already listens on 3002 |

Tunnel for browser QA:

```bash
ssh -N -L 3002:127.0.0.1:3003 dincouture-vps
```

## Next (separate session)

Browser waiver checklist → fill `browser-waiver-closure.md` from template.

Do **not** run Stage 1 SQL until browser waivers PASS.
