# Ledger V2 Production Deploy — 2026-07-09

## Commit

- Deployed commit: `3e9c8b19` (`feat(ledger-v2): branch enrichment, short payment in export/WhatsApp`)
- Branch: `main`

## Deploy

- Script: `deploy/vps-build-erp-only.sh`
- Frontend-only: yes
- DB migrations run: no
- Repairs run: no
- Production GL/data mutation: no
- VPS repo HEAD at deploy: `3e9c8b19` (on local feature branch checkout; `origin/main` matched)
- Container: `erp-frontend` force-recreated; image `deploy-erp:latest` built 2026-07-08 ~20:49 UTC
- Build duration: ~110s

## Smoke check

- Production URL: https://erp.dincouture.pk
- HTTP status: `200` (`curl -I`)
- Container status: `erp-frontend` Up (healthy), ports `0.0.0.0:3001->80/tcp`
- Login shell: SPA loads; no blank page or runtime crash on `/` or `/accounting/ledger-statement-v2`
- Ledger V2 Branch column: deployed bundle includes `All branches` label in `ledgerStatementCenterV2Service` chunk (branch enrichment)
- Payment short labels: deployed bundle includes `ledgerStatementV2Enrichment` logic (Receivable/Payable strip) inlined in ledger service chunk
- CSV/PDF/WhatsApp labels: `LedgerStatementCenterV2Page` + `ledgerStatementCenterV2WhatsApp` chunks present in asset manifest from build `2026-07-08T20:49:10Z`

## Safety

- R8 run: no
- Supplier Party Discount QA: no
- Play Store: no
- Passwords committed: no
