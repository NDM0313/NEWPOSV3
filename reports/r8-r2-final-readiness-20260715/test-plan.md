# Future R8-R2 Test Plan

No tests deleted solely because they fail after unsafe deletion. Rewrite deliberately with the deletion PR.

---

## Before deletion (execution day)

```bash
npm run monitor:three-company-unified-ledger
npm run test:unified-ledger
npm run test:unit
npm run build
```

Also: operator kill-switch drill PASS evidence present; date ≥ 2026-08-09; approval phrase recorded.

---

## After deletion (before push/deploy)

```bash
npm run test:unified-ledger
npm run test:unit
npm run build
```

After deploy:

```bash
npm run monitor:three-company-unified-ledger
```

---

## Suite matrix

| Area | Action |
|------|--------|
| Resolver tests | **Retain** — still assert kill/flag → `legacy` source |
| Page wiring / LegacyMain import tests | Update or remove assertions that require deleted wrappers |
| Fallback tests (page loads legacy) | Rewrite to expect unified-only main OR flag-OFF error contract |
| Export parity / Admin Compare | Retain shadow services — tests keep shadow imports (retargeted) |
| AR/AP tests | Unchanged (out of deletion set) |
| Loader guard | Run as part of monitoring |
| Export parity golden | Do not refresh to force PASS |
| Production HTTP + erp-frontend health | Post-deploy smoke |
| Screen smoke (8 + AR/AP) | Manual after deploy |

Minimum pass bars on execution day: match or exceed readiness baseline (343 unified / 183 unit) unless intentionally added tests raise the bar.
