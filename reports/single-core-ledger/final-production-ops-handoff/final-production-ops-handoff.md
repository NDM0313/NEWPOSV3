# Final production ops handoff — Single Core Ledger

**Status:** `FINAL PRODUCTION OPS HANDOFF COMPLETE`  
**Program:** OLD ERP / DIN Collection ERP — three-company unified ledger  
**Production:** https://erp.dincouture.pk  
**Generated:** 2026-06-29T12:00:00.000Z  
**Latest main commit:** `6b701ed1` — `docs(accounting): close monitoring password rotation`

---

## Program mode

The Single Core Ledger program is now in **production ops mode**. Rollout, migration closure, credential hardening, password rotation, and post-rotation monitoring are complete. Ongoing work is **read-only scheduled monitoring only**.

**Daily command:**

```powershell
npm run monitor:three-company-unified-ledger
```

**Credential rules:**

- Use per-company `QA_BROWSER_PASSWORD_CHINA`, `QA_BROWSER_PASSWORD_BRIDAL`, `QA_BROWSER_PASSWORD_COUTURE` only.
- Do **not** store passwords in the repo, docs, reports, or logs.
- Do **not** use generic `QA_BROWSER_PASSWORD` fallback unless emergency and explicitly documented in an incident report.
- No automatic fixes. No migrations in monitoring.

**Blocked without separate approval:** R7 · R8 · next company rollout.

---

## Final state table

| Company | Flags | Loaders | Golden party | Status |
|---------|-------|---------|--------------|--------|
| DIN CHINA | 12/12 ON | 5/5 ON | MR JALIL | Stable |
| DIN BRIDAL | 12/12 ON | 5/5 ON | MR REHAN ALI | Stable |
| DIN COUTURE | 12/12 ON | 5/5 ON | DHARIA | Stable |

| Guard | Value |
|-------|-------|
| Other-company loaders | **0** |
| Migration closure | **Complete** — no pending approved migrations |
| Password rotation | **Complete** |
| Post-rotation monitoring | **PASS** @ 2026-06-29 |
| R7 roznamcha_payment RPC | **DESIGN ONLY** |
| R8 legacy engine retirement | **BLOCKED** |
| Next company rollout | **BLOCKED** — finance sign-off |

---

## Golden values (monitoring PASS criteria)

### DIN CHINA

| Screen | Value |
|--------|-------|
| MR JALIL closing (LV2 / Account Statement / Party Ledger) | PKR 216,300 |
| Trial Balance debit = credit | PKR 407,957,271.02 |
| Roznamcha Cash In / Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 |

### DIN BRIDAL

| Screen | Value |
|--------|-------|
| MR REHAN ALI closing | PKR 530,000 |
| Trial Balance debit = credit | PKR 21,919,575 |
| Roznamcha Cash In / Out / Closing | 1,836,350 / 917,780 / 918,570 |

### DIN COUTURE

| Screen | Value |
|--------|-------|
| DHARIA closing | PKR 4,488,088 |
| Trial Balance debit = credit | PKR 49,747,104 |
| Roznamcha Cash In / Out / Closing | 85,000 / 34,500 / 50,500 |

---

## Evidence paths

| Artifact | Path |
|----------|------|
| Latest monitoring pointer | [`../operational-monitoring/latest-three-company-monitoring.json`](../operational-monitoring/latest-three-company-monitoring.json) |
| Post-rotation monitoring (authoritative) | [`../operational-monitoring/three-company-monitoring-2026-06-29T07-42-30-177Z.md`](../operational-monitoring/three-company-monitoring-2026-06-29T07-42-30-177Z.md) |
| Password rotation closure | [`../operational-monitoring/password-rotation-final-closure-manifest.json`](../operational-monitoring/password-rotation-final-closure-manifest.json) |
| Production ready pack | [`../../../docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md) |

**Monitoring summary:** overall PASS · per-company credentials · `generic_fallback_allowed`: false · `other_company_loaders_on`: 0 · `migrations_run`: false · `gl_mutations`: false

---

## Ops schedule docs

| Doc | Path |
|-----|------|
| Scheduled ops pack | [`../operational-monitoring/scheduled-monitoring-ops-pack.md`](../operational-monitoring/scheduled-monitoring-ops-pack.md) |
| Windows Task Scheduler | [`../operational-monitoring/windows-task-scheduler-guide.md`](../operational-monitoring/windows-task-scheduler-guide.md) |
| VPS cron (docs only) | [`../operational-monitoring/vps-cron-monitoring-guide.md`](../operational-monitoring/vps-cron-monitoring-guide.md) |
| Monitoring runbook | [`../operational-monitoring/monitoring-runbook.md`](../operational-monitoring/monitoring-runbook.md) |
| Ops schedule closure | [`../operational-monitoring/ops-schedule-closure-report.md`](../operational-monitoring/ops-schedule-closure-report.md) |

---

## Incident response docs

| Doc | Path |
|-----|------|
| Full incident runbook | [`../operational-monitoring/monitoring-incident-response-runbook.md`](../operational-monitoring/monitoring-incident-response-runbook.md) |
| Quick reference | [`incident-quick-reference.md`](incident-quick-reference.md) |
| Blocked future work | [`blocked-future-work-register.md`](blocked-future-work-register.md) |

---

## Tests / build / deploy

| Check | Result |
|-------|--------|
| `npm run test:unified-ledger` | 256/256 PASS |
| `npm run build` | PASS |
| Frontend deploy | **SKIPPED** — docs/reports only |

See [`deploy-or-skip-notes.md`](deploy-or-skip-notes.md).

---

## Rollback references (L1 per loader — use only on incident)

| Resource | Path |
|----------|------|
| Rollback SQL pack | `scripts/single-core-ledger/phase-21x-rollback-*.sql` |
| Expansion readiness checklist | [`../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md) |
| Per-company rollout runbook | [`../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) |

Do **not** execute rollback SQL without incident approval and finance sign-off.

---

## Constraints honored (archive lock)

- No migrations run in this handoff
- No R7 applied · no R8 started · no new company enabled
- No GL, journal, payment, balance, flag, or report-total mutations
- No FX / multi-currency app changes
- No ERP runtime/source behavior changes
- No credentials committed · no passwords printed

---

## Exact ongoing operation

Continue scheduled operational monitoring only:

```powershell
npm run monitor:three-company-unified-ledger
```

Use per-company `QA_BROWSER_PASSWORD_*` only. Do **not** start R7, R8, or another company without separate written approval.

**Operator checklist:** [`daily-monitoring-checklist.md`](daily-monitoring-checklist.md) · **Next actions:** [`operator-next-actions.md`](operator-next-actions.md)
