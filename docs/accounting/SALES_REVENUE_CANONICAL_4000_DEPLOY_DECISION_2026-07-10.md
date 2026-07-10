# Sales Revenue Canonical 4000 deploy decision — 2026-07-10

## Summary

| Item | Value |
|------|-------|
| Runtime source changed | **yes** (`src/app/…`, `erp-mobile-app/…`) |
| Deploy required | **yes** (frontend ERP bundle) |
| Deploy script | `bash deploy/vps-build-erp-only.sh` |
| DB migrations | **no** |
| Repairs | **no** |
| GL mutation | **no** |

## Rationale

Reverses `b7fa557d` 4100-first posting policy. Future sales and returns must credit **4000** when both accounts exist. Web bundle deploy on VPS is required for production behavior change.

## Pre-deploy gates (local)

- `npm run test:unified-ledger` — required PASS
- `npm run test:unit` — required PASS
- `npm run build` — required PASS

## Deploy steps

```bash
ssh dincouture-vps
cd /root/NEWPOSV3
git fetch origin main
git pull --ff-only origin main
bash deploy/vps-build-erp-only.sh
```

## Post-deploy smoke

- `curl -I https://erp.dincouture.pk` → HTTP 200
- Login shell loads
- No production sale created in smoke

## Safety

- No migrations
- No repairs
- No transfer JE
- R8-R2 not started
