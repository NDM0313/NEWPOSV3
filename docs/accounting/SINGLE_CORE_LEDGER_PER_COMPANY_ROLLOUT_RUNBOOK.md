# Single Core Ledger — Per-Company Rollout Runbook (R4)

**Status:** ACTIVE template — **do not execute flag SQL without finance sign-off per company**  
**DIN CHINA reference:** Phases 2.9–2.15 evidence under `reports/single-core-ledger/`

---

## Before any non–DIN CHINA company

1. Finance sign-off CSV/record (see [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md))
2. Company golden fixtures captured on **legacy loaders** → `reports/single-core-ledger/<company-slug>/golden-fixtures.json`
3. Add profile to `scripts/single-core-ledger/monitoring-company-profiles.json` (not `_template` until approved)
4. Cross-company flag audit: **zero** other companies with `unified_ledger_loader_*` ON

---

## Staged enablement order (one company at a time)

| Step | Flag / action | Gate before next |
|------|---------------|------------------|
| 1 | `unified_ledger_pilot` | Admin Compare baseline; no console errors |
| 2 | `unified_ledger_engine` | Pilot soak or signed accelerated waiver |
| 3 | `unified_ledger_screen_*` (preview) | Per-screen preview QA PASS |
| 4 | `unified_ledger_loader_*` (one screen) | Golden match + L1 rollback SQL staged |
| 5 | Repeat step 4 for each loader | 24h monitoring or signed waiver |
| 6 | `MONITORING_PROFILE=<slug> node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs` | All gates PASS |

**Never** bulk-enable all loaders in one SQL script.

---

## Rollback (L1 per loader)

Scripts: `scripts/single-core-ledger/phase-21x-rollback-*.sql` — **operator-run only on production incident**.

---

## Monitoring (R6)

```bash
# DIN CHINA (default)
MONITORING_PROFILE=din-china node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs

# Future company (after profile + finance sign-off)
MONITORING_PROFILE=<slug> QA_BROWSER_PASSWORD=... node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs
```

Evidence writes to `reports/single-core-ledger/<profile.evidence_subdir>/`.

---

## Explicit prohibitions

- No multi-company flag enable in one change set
- No copying DIN CHINA golden values
- No migrations/GL repair as part of rollout unless separately approved
