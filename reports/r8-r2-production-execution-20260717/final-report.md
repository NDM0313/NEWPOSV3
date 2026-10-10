# R8-R2 Production Execution Evidence — 2026-07-17

## Baseline

- Pre-delete tag: `r8-r2-pre-code-deletion-20260717` = `17a6c131`
- Merged runtime: `390f922c`
- Production runtime after deploy: `390f922c`
- Prior production runtime: `b8fec34b` (historical); VPS was on `17a6c131` docs tip before this deploy

## Gates

See `gates.md`.

## Validation pre-merge

- unified: 350/350
- unit: 188/188
- build: PASS
- diff check: PASS

## Deploy

- Method: `ssh dincouture-vps` → `bash deploy/vps-build-erp-only.sh`
- Result: Done; container recreated; healthy
- HTTP: 200

## Not done

- Production kill toggle
- Full Playwright three-company PASS (agent timeout)
- BS/P&L fallback deletion
- Mobile / Contacts / Play Store
