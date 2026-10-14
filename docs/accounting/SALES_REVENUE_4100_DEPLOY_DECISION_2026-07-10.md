# Sales Revenue 4100 deploy decision — 2026-07-10

## Summary

| Item | Value |
|------|-------|
| Runtime source changed | **yes** (`src/app/…`) |
| Deploy required | **yes** (frontend ERP bundle) |
| Deploy script | `bash deploy/vps-build-erp-only.sh` |
| DB migrations | **no** |
| Repairs | **no** |
| GL mutation | **no** |

## Rationale

Posting logic for new sales and sale returns lives in the web ERP bundle (`saleAccountingService`, `AccountingContext`, `studioCustomerInvoiceService`). Production behavior changes only after frontend rebuild on VPS.

Mobile (`erp-mobile-app`) changes are source-only in this commit; Play Store / APK release is **not** part of this phase.

## Pre-deploy gates (local)

- `npm run test:unified-ledger` — PASS
- `npm run test:unit` — PASS
- `npm run build` — PASS
- `npm run monitor:three-company-unified-ledger` — PASS

## Deploy steps

```bash
ssh dincouture-vps
cd /root/NEWPOSV3
git fetch origin main
git pull --ff-only origin main
bash deploy/vps-build-erp-only.sh
```

## Post-deploy smoke

- https://erp.dincouture.pk — HTTP 200
- Login shell loads
- No production accounting mutation in smoke (draft/quotation only if existing QA convention allows)

## Safety

- No migrations
- No repairs
- No transfer JE
- R8-R2 not started
