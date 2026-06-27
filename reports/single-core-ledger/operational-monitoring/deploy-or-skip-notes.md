# Deploy / skip notes — operational monitoring

**Decision:** **SKIP DEPLOY**

Monitoring credential hardening changes only `scripts/single-core-ledger/*` and docs/reports. No `src/` ERP runtime bundle changes. No VPS frontend deploy required.

If future runs change `src/` accounting UI, deploy only after explicit approval and `npm run build` PASS.
