# Production frontend deploy notes

**Generated:** 2026-06-29

---

## Deploy command

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git fetch origin main && git pull origin main && bash deploy/vps-build-erp-only.sh"
```

---

## Deployed commit

`cca0c246` — docs(accounting): add local browser QA for party discount and signup OTP  
(includes feature `ae6c69d0` on main)

---

## Timestamps (UTC)

| Event | Time |
|-------|------|
| Deploy start (build) | ~2026-06-29T19:36Z |
| Deploy end (container healthy) | ~2026-06-29T19:38Z |
| CACHEBUST | `1782761016` |

---

## Health

| Check | Result |
|-------|--------|
| `erp-frontend` | **Up (healthy)** |
| URL | https://erp.dincouture.pk |
| VPS HEAD | `cca0c246` |

---

## Scope exclusions confirmed

| Item | Performed |
|------|-----------|
| DB migrations | **No** |
| Supabase DB apply | **No** |
| Feature flag changes | **No** |
| GL / accounting mutations | **No** |
| Cash Flow loader swap | **No** |
| Backend DB containers | **No** (ERP image rebuild + force-recreate only) |

---

## Result

**PASS** — frontend-only deploy completed successfully.
