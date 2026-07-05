# Frontend Deploy — Web Sales/Purchase Save Performance — 2026-07-05

## Operator approval

Nadeem approved **frontend-only** deploy of commit `37e49f2f` to production (`erp.dincouture.pk`).

## Deployed commit

| Field | Value |
|-------|-------|
| Commit | `37e49f2feb81f35f007b8c180a1c2c4c54001772` |
| Message | `fix(web): speed up sales and purchase save flow` |
| VPS HEAD after pull | `37e49f2f` (matches origin/main) |

## Deploy command

Executed on VPS via SSH config host `dincouture-vps`:

```bash
cd /root/NEWPOSV3
git fetch origin main && git pull --ff-only origin main
bash deploy/vps-build-erp-only.sh
```

Script behavior: pull latest, `docker compose build --no-cache erp`, `docker compose up -d --force-recreate erp`. **No migrations, no DB scripts, no repairs.**

Deploy completed successfully (~117s). Container `erp-frontend` recreated and started.

## Pre-deploy validation (local office PC)

| Step | Result |
|------|--------|
| `npm run test:unit` | PASS — 126/126 |
| `npm run test:unified-ledger` | PASS — 335/335 |
| `npm run build` | PASS (~62s) |

## Production smoke check

| Check | Result |
|-------|--------|
| `https://erp.dincouture.pk` loads | PASS — Sign In shell visible |
| Login page / app shell | PASS |
| ERP container running | PASS — `erp-frontend` Up |
| Blank page / fatal error | None observed on public login fetch |

Authenticated Sales/Purchase page navigation requires operator login — not exercised in this automated pass.

## Live save latency spot-check

| Test | Performed |
|------|-----------|
| Live test sale created | **No** — pending operator manual test after login |
| Live test purchase created | **No** — pending operator manual test after login |

**Recommended operator spot-check (post-deploy):**

1. Hard refresh (`Ctrl+Shift+R`) on `https://erp.dincouture.pk`
2. Create one small safe test sale — confirm spinner clears faster; single success toast; attachments/shipping do not block toast
3. Create one small safe test purchase — same checks; no duplicate payment JE

## Fix scope (deployed)

- Batched variation prefetch in `SaleForm`
- Background Z1 stock sync on create (Sales/Purchase contexts)
- Removed duplicate payment JE and duplicate stock validation on sale create
- Immediate success toast after core save; deferred attachments/shipment rows

No migration files, credentials, APK/AAB, or GL semantic changes in this deploy.

## Safety confirmation

| Check | Status |
|-------|--------|
| migrations_run | false |
| repairs_run | false |
| r8_run | false |
| play_store_upload | false |
| production_gl_repair | false |
| credentials_committed | false |
| sensitive_files_staged | false |
| production_gl_mutation_by_deploy | false |

## Deploy status

**FRONTEND_DEPLOYED** — `erp.dincouture.pk` serving build from commit `37e49f2f`.
