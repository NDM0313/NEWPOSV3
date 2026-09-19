# Staging JE guard — disposable Auth + PostgREST templates

Loopback-only GoTrue + PostgREST against VPS clone DB `ledger_stage_20260919_prodcheck`.

**Never** point these at live `postgres` or `*.dincouture.pk`.

| Script | Purpose |
|--------|---------|
| `bootstrap-http-stack.sh` | Create `/root/je-guard-stage` compose + staging JWT keys (VPS) |
| `grant-clone-roles.sh` | CONNECT/USAGE on clone after `--no-acl` restore |
| `create-identities.sh` | Company A/B GoTrue users + `public.users` link |
| `apply-migration-clone.sh` | Apply guard migration to clone only + ACL checks |
| `run-jwt-matrix.sh` | Real JWT same/cross-company + repair denial + GUC spoof |
| `run-posting-smoke.sh` | Five JE-line PostgREST smoke cases |
| `prod-readonly-preflight.sql` | SELECT-only IBRAHIM / merge_pairs / absent-objects on live `postgres` |
| `teardown-http-stack.sh` | Stop staging containers; keep clone DB |
| `docker-compose.template.yml` | Secret-free compose shape (ports 18081/18080) |

Gate evidence: `reports/supplier-coa-dual-audit-20260919/STAGING_JE_GUARD_GATE_20260919.md`.
