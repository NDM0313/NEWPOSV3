# VPS Frontend Deploy — Office Session 2026-07-09

## Decision

**Deploy applied** — `deploy/vps-build-erp-only.sh` on production VPS.

## Baseline

| Item | Value |
|------|--------|
| Commit deployed | `8687f149` |
| Script | `deploy/vps-build-erp-only.sh` |
| Migrations run | **no** |
| Repairs run | **no** |
| GL/data mutation | **no** |

## Smoke check

| Check | Result |
|-------|--------|
| https://erp.dincouture.pk | **HTTP 200** |
| `erp-frontend` | **Up (healthy)** |
| VPS HEAD | `8687f149` |

## Safety

- R8: not run
- Play Store: not released
- Passwords committed: no
