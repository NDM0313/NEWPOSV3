# Capability application deploy report

## Deploy

| Item | Value |
|------|-------|
| Workflow | `bash deploy/deploy.sh` on `dincouture-vps` (`/root/NEWPOSV3`) |
| Exit | `0` |
| Deployed git SHA | `356819d0759948f1583c3b9f22e9dded4d9f2529` |
| Embedded asset marker | `356819d0` present in built frontend assets |
| Image/container | `erp-frontend` ← `deploy-erp` |
| Health | `healthy` / `running` |
| HTTPS `https://erp.dincouture.pk/` | **200** |
| HTTPS `https://erp.dincouture.pk/health` | **200** |
| Crash loop | none observed |

Migrations during deploy: SKIP for the three capability files (already applied).

PostgREST: schema cache reload observed at ~`21:14:56Z` after migration apply (expected).

## Not in this phase

- Mobile IPA/APK release: **not published**
- Business T0 / contact type flips: **not executed**

## Rollback app anchor

Prior application SHA: `c253d4c17e77f3353650a2bd6eee760516e6e95d`
