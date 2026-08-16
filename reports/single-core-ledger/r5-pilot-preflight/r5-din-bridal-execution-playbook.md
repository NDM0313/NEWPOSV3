# R5 — DIN BRIDAL execution playbook

**Status:** READY — execute only after finance sign-off  
**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**Golden party:** MR REHAN ALI (`cee98d04-0a04-4692-857c-18df75bcb466`)

---

## Preconditions

1. `finance_sign_off_ref` set in [`din-bridal/golden-fixtures.json`](../din-bridal/golden-fixtures.json)
2. Legacy browser goldens captured (run `node scripts/single-core-ledger/run-r5-golden-capture-din-bridal.mjs` with DIN BRIDAL login)
3. `requires_finance_sign_off` cleared on `din-bridal` monitoring profile
4. Cross-company guard: 0 other-company loaders ON — [`r5-cross-company-loader-guard.sql`](../../../scripts/single-core-ledger/r5-cross-company-loader-guard.sql)
5. DIN CHINA 12 flags remain ON throughout

---

## Staged enablement (one SQL file at a time)

| Step | SQL file | Gate before next |
|------|----------|------------------|
| 0 | `din-bridal/r5-preflight-flags.sql` (read-only) | Baseline documented |
| 1 | `din-bridal/r5-enable-pilot.sql` | Admin Compare baseline; no console errors |
| 2 | `din-bridal/r5-enable-engine.sql` | Pilot soak or signed waiver |
| 3a | `r5-enable-screen-ledger-v2.sql` | Preview QA PASS |
| 3b | `r5-enable-screen-account-statement.sql` | Preview QA PASS |
| 3c | `r5-enable-screen-trial-balance.sql` | Preview QA PASS |
| 3d | `r5-enable-screen-party-ledger.sql` | Preview QA PASS |
| 3e | `r5-enable-screen-roznamcha.sql` | Preview QA PASS |
| 4a | `r5-enable-loader-ledger-v2.sql` | MR REHAN ALI golden match; L1 rollback staged |
| 4b | `r5-enable-loader-account-statement.sql` | Golden match |
| 4c | `r5-enable-loader-trial-balance.sql` | TB debit = credit @ golden |
| 4d | `r5-enable-loader-party-ledger.sql` | Party golden match |
| 4e | `r5-enable-loader-roznamcha.sql` | Roznamcha parity golden match |

**Rollback:** matching `r5-rollback-*.sql` for the step that failed.

---

## Post-enable monitoring

```bash
MONITORING_PROFILE=din-bridal QA_BROWSER_PASSWORD=... node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs
```

Evidence: `reports/single-core-ledger/din-bridal-monitoring/`

---

## Golden targets (RPC proxy — validate with browser before enable)

| Screen | Fixture | RPC proxy (PKR) |
|--------|---------|-----------------|
| Party / LV2 / AS | MR REHAN ALI closing | 530,000 |
| Trial Balance | debit = credit | 21,919,575 |
| Roznamcha | Cash In / Out / Closing | 1,916,350 / 942,780 / 973,570 (GL proxy — capture legacy UI) |

---

## Stop conditions

- Any golden FAIL → L1 rollback that loader only
- Other company loader flag turns ON → stop; run cross-company guard
- DIN CHINA loader regression → stop all R5 work

---

## Deploy

After any frontend fix only:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash scripts/single-core-ledger/deploy-phase-r5a-production-frontend-vps.sh"
```
