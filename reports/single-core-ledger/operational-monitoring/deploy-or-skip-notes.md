# Deploy / skip notes — operational monitoring

**Decision:** **SKIP DEPLOY**

Ops schedule closure, incident runbooks, and scheduling guides are **docs/reports only**. No `src/` ERP runtime changes. No VPS cron changes. No frontend deploy.

Credential hardening scripts (`monitoringCredentials.mjs`) do not require production bundle deploy.

**Reason:** No ERP runtime bundle change.
