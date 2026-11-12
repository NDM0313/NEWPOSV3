# Monitoring credential hardening report

**Run:** THREE-COMPANY MONITORING CREDENTIAL HARDENING + OPS SCHEDULE CLOSURE  
**Generated:** 2026-06-14T00:00:00Z

---

## Root cause — first failed background run

The first `npm run monitor:three-company-unified-ledger` background run failed on **din-bridal** because a shell-level generic `QA_BROWSER_EMAIL` (`din@yahoo.com`, DIN CHINA user) was visible when the runner started. Golden party **MR REHAN ALI** timed out — wrong company binding, not accounting drift.

Evidence of failed run: `three-company-monitoring-2026-06-27T14-04-10-124Z.json` (not committed — wrong bridal email in log).

---

## Successful rerun (prior commit)

| Item | Value |
|------|-------|
| Commit | `50547061` |
| Evidence | `three-company-monitoring-2026-06-27T14-14-14-851Z.json` |
| Result | All three profiles PASS |

---

## Credential precedence rules (implemented)

1. **Email (three-company run):** `QA_BROWSER_EMAIL_<COMPANY>` → profile default → built-in default. Generic `QA_BROWSER_EMAIL` **never** used.
2. **Password (three-company run):** `QA_BROWSER_PASSWORD_<COMPANY>` required **or** `ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true` + `QA_BROWSER_PASSWORD`.
3. **Single-profile run:** per-company vars → generic `QA_BROWSER_EMAIL` / `QA_BROWSER_PASSWORD` → defaults.
4. Child processes receive per-company env keys only; generic email stripped from spawn env.
5. Golden party timeout → explicit credential-binding error message.
6. Passwords redacted from stdout/stderr; only source labels logged (`per-company`, `generic-fallback-explicit`, etc.).

---

## Tests added

- `scripts/single-core-ledger/monitoringCredentials.test.mjs`
- Updated `run-three-company-operational-monitoring.test.mjs`

---

## Command

```powershell
# Recommended
$env:QA_BROWSER_PASSWORD_CHINA = "..."
$env:QA_BROWSER_PASSWORD_BRIDAL = "..."
$env:QA_BROWSER_PASSWORD_COUTURE = "..."
npm run monitor:three-company-unified-ledger
```

---

## Constraints honored

No migrations · no R7 · no R8 · no new company · no flag mutations · no GL changes · no credentials committed · no passwords printed
