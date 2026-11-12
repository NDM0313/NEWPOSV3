# Production Deployment Matrix

**Audit date:** 2026-07-15
**Method:** `ssh dincouture-vps` read-only + local `git rev-parse`

| Field | Value |
|-------|--------|
| GitHub `origin/main` | `5cf65f4c73fed799426e32bf4214cf8541f28c9b` |
| Local HEAD | same |
| VPS `/root/NEWPOSV3` HEAD | `5cf65f4c` |
| Runtime delta GitHub ↔ VPS | **0** |
| `erp-frontend` | Up ~19h, healthy; image `deploy-erp` |
| `VITE_BUILD_COMMIT` | `5cf65f4c` |
| HTTP `https://erp.dincouture.pk` | **200** |
| Pending runtime deploy for SCE | **None** (matched) |
| Pending SCE core migrations | **None known** (RPCs live) |

## Feature deployment table

| Feature | GitHub commit | On VPS? | Migration required | Migration applied | UI live | Verified prod | Rollback | Status |
|---------|---------------|---------|--------------------|-------------------|---------|---------------|----------|--------|
| Eight unified loaders (R8-R1) | `bc4528e5` era; flags live | YES | flags / prior RPCs | YES | YES | YES (flags + health) | L0–L2 | OPERATIONAL COMPLETE |
| Ledger V2 deploy evidence | `3e9c8b19` / `5c2610e0` | YES (superseded by later HEAD) | no for flags | yes | yes | prior evidence | tag | COMPLETE |
| DIN CHINA Phase 2.16 golden | `8bbb01f0` | YES (fixtures in tree) | no | n/a | n/a | monitoring PASS 07-12; **not re-run 07-15** (creds) | fixtures | OPERATIONAL |
| AR/AP Phase 2b RPC | `75c12cd7` | YES | `20260712120000_*` | YES since 2026-07-11 | YES | bridal FAIL live confirmed | fallback / rollback to `8bbb01f0` | PARTIAL |
| AR/AP frontend wireup | `75c12cd7`+ | YES at `5cf65f4c` | n/a | n/a | YES | UI not signed off | fallback | FRONTEND LIVE / parity blocked |
| R8-R2 deletion | n/a | n/a | no | n/a | n/a | n/a | n/a | NOT STARTED |
| Play Store | n/a | n/a | n/a | n/a | n/a | SKIPPED | n/a | OUT OF SCOPE |

## Older VPS pins (stale for current truth)

Office pull notes previously pinned VPS at `84eb1363` / deploy of `8687f149`. **Superseded** by live inspect 2026-07-15 showing `5cf65f4c`.
