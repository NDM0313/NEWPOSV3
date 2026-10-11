# Ops results checklist — paste outputs here

Fill after running [`OPS_RUNBOOK.md`](./OPS_RUNBOOK.md) on the VPS / office workstation.

## Part 1 — Health

**Ran at (UTC):** _______________

```text
# paste: docker ps --filter name=erp-frontend ...
```

```text
# paste: docker logs --tail 50 erp-frontend-preview
```

```text
# paste: curl -sI http://127.0.0.1:3002/ | head -20
```

```text
# paste: curl -sI http://127.0.0.1:3002/m | head -20
```

```text
# paste: curl -sI http://127.0.0.1:3002/m/ | head -20
```

```text
# paste: ASSET=... and curl -sI for that asset
```

| Check | Pass? |
|-------|-------|
| Preview on :3002, prod on :3001 | [ ] |
| Logs clean | [ ] |
| `/` 200 | [ ] |
| `/m` 301 | [ ] |
| `/m/` 200 | [ ] |
| asset 200 | [ ] |

## Part 2 — Tunnel

| Check | Pass? |
|-------|-------|
| `ssh -N -L 3002:127.0.0.1:3002 dincouture-vps` (or IDE forward) | [ ] |
| http://localhost:3002 loads | [ ] |

## Part 3 — Sidebar / ledger smoke

| Check | Pass? |
|-------|-------|
| 260↔80 toggle | [ ] |
| Refresh → expanded | [ ] |
| No hydration console errors | [ ] |
| Optional `/?view=accounting` | [ ] |
| Optional `/?view=party-ledger` | [ ] |

## Gate verdict

- [ ] **READY** for E2E browser inspection on :3002  
- [ ] **NOT READY** — notes: _______________
