# Deploy / skip notes — post-rotation closure

**Decision:** **SKIP DEPLOY**

Post-rotation closure, password rotation final report, and updated ops docs are **reports/docs only**. No `src/` ERP runtime changes. No VPS cron changes. No frontend deploy.

**Reason:** No ERP runtime bundle change.

**Verification:** `npm run test:unified-ledger` 256/256 PASS · `npm run build` PASS
