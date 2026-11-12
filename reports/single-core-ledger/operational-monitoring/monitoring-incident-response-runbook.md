# Monitoring incident response runbook

**Program:** OLD ERP Single Core Ledger  
**Generated:** 2026-06-14T00:00:00Z  
**Production:** https://erp.dincouture.pk

---

## Global rules (all incidents)

| Do | Don't |
|----|-------|
| Preserve JSON/MD evidence and screenshots | Auto-fix GL, journals, payments, balances |
| Triage credential vs accounting | Run migrations without approval |
| Notify finance on golden mismatch | Run feature-flag SQL without approval |
| Use L1 rollback SQL only with incident approval | Start R7 or R8 |
| Re-run monitoring after approved fix | Enable another company |

---

## Decision tree

```
Monitoring FAIL
├── Golden party timeout / credential-binding error?
│   └── → Section 1
├── Browser/session timeout?
│   └── → Section 2
├── Golden value mismatch (closing/TB/Roznamcha)?
│   └── → Section 3
├── Loader flag missing (read-only guard)?
│   └── → Section 4
├── Cross-company loader leakage?
│   └── → Section 5
├── Console/RPC errors only?
│   └── → Section 6
└── Build/test failure (local/CI)?
    └── → Section 7
```

---

## 1. Credential-binding failure

**Symptoms:** Timeout selecting MR REHAN ALI / DHARIA / MR JALIL; error mentions "credential binding" or "wrong company".

**Check first:**

- Per-company `QA_BROWSER_EMAIL_*` matches user bound to target company  
- Generic `QA_BROWSER_EMAIL` not relied upon for three-company run  
- User still active in auth  

**Do not:** Assume accounting regression; do not change loaders or GL.

**Rollback:** Not needed.

**Finance approval:** Not required for credential fix.

**Escalate:** If correct credentials still fail — ops + engineering (user-company binding in DB).

---

## 2. Browser / session timeout

**Symptoms:** Playwright timeout on login, navigation, or network idle.

**Check first:**

- Production URL reachable  
- Playwright browsers installed  
- Headless environment supports ERP (logged-on user for Task Scheduler)  

**Do not:** Re-run flag SQL or migrations.

**Rollback:** Not needed.

**Finance approval:** Not required.

---

## 3. Golden value mismatch

**Symptoms:** Ledger V2 / AS / Party / TB / Roznamcha actual ≠ finance fixture.

**Check first:**

- Correct company credentials (rule out wrong company data)  
- Date range wide enough (monitoring uses lifetime-wide filters)  
- Recent legitimate business activity (new postings)  

**Do not:** Auto-patch balances or run repair RPCs.

**Rollback:** Consider L1 loader rollback **only** if unified loader caused proven regression — finance + ops approval required.

**Finance approval:** **Required** before any production accounting change.

**Escalate:** P1 — stop scheduled monitoring PASS claims until resolved.

---

## 4. Loader flag missing

**Symptoms:** Read-only guard shows flags OFF or other-company loaders ON.

**Check first:**

- `three-company-loader-guard-pipe.sql` output via VPS  
- Whether intentional change was approved  

**Do not:** Run enable SQL without staged rollout approval.

**Rollback:** L1 rollback scripts per company if unauthorized change — ops + finance.

**Finance approval:** Required for re-enable.

---

## 5. Cross-company leakage

**Symptoms:** Unapproved company has `unified_ledger_loader_*` ON.

**Check first:**

- Full flag export — read-only only  
- Recent ops activity  

**Do not:** Disable loaders without rollback plan.

**Rollback:** Per-company rollback SQL for unauthorized company only.

**Finance approval:** Required.

---

## 6. Console / RPC errors

**Symptoms:** Material Supabase/RPC errors in browser console; may be WAIVED if non-material.

**Check first:**

- Error text in monitoring JSON  
- Repro on single profile  
- Whether error is COA seed noise (known bridal waiver pattern)  

**Do not:** Apply R7 or schema migrations as fix.

**Rollback:** Only if errors correlate with golden mismatch.

**Finance approval:** If errors affect reported totals.

---

## 7. Build / test failure

**Symptoms:** `npm run test:unified-ledger` or `npm run build` fails locally/CI.

**Check first:**

- Failure in `src/` vs scripts only  
- Recent commits  

**Do not:** Deploy broken bundle to production.

**Rollback:** Revert engineering commit — production unaffected if not deployed.

**Finance approval:** Not required unless deploying accounting UI changes.

---

## Evidence preservation

1. Save `latest-three-company-monitoring.json`  
2. Copy to local logs folder with timestamp  
3. Screenshot if UI-related  
4. Open investigation MD under `operational-monitoring/` — **no secrets**  

---

## Related docs

- [`scheduled-monitoring-ops-pack.md`](scheduled-monitoring-ops-pack.md)  
- [`monitoring-runbook.md`](monitoring-runbook.md)  
- [`password-rotation-closure.md`](password-rotation-closure.md)  
- Rollback SQL: `scripts/single-core-ledger/din-couture/dc-rollback-*.sql`, `din-bridal/`, `phase-21x-rollback-*.sql`
