# Day 11 frontend deploy — 2026-07-07

| Item | Value |
|------|--------|
| Script | `deploy/vps-build-erp-only.sh` |
| VPS | `dincouture-vps` (`/root/NEWPOSV3`) |
| Git after pull | `711d2307` (includes Day 11 calendar evidence) |
| Container | `erp-frontend` force-recreate |
| Migrations | **none** |
| GL mutations | **none** |
| Result | **SUCCESS** — image built, container started |

Production URL: https://erp.dincouture.pk

Hard refresh (`Ctrl+Shift+R`) on `/m/` if caching old bundle.
