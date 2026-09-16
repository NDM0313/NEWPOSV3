# Phase 2.12X — closeout and monitoring

**Status:** `PHASE 2.12X CLOSEOUT PASS — ready to choose next rollout screen`  
**Date:** 2026-06-26  
**Scope:** DIN CHINA only — monitoring and documentation; no flag changes

---

## Live flag state (DIN CHINA)

| Flag | State |
|------|-------|
| `unified_ledger_pilot` | ON |
| `unified_ledger_engine` | ON |
| `unified_ledger_screen_ledger_v2` | ON |
| `unified_ledger_loader_ledger_v2` | ON |
| `unified_ledger_screen_account_statement` | ON |
| `unified_ledger_loader_account_statement` | ON |
| `unified_ledger_screen_trial_balance` | ON |
| `unified_ledger_loader_trial_balance` | ON |

**OFF / absent:** Roznamcha, Party Ledger, Cash/Bank, kill switch  
**Other companies:** no loader flags ON (verified SQL)

Snapshot: [`phase-212x-closeout-flags.json`](phase-212x-closeout-flags.json)

---

## Live screen status (2026-06-26 closeout verify)

| Screen | Main loader | Golden check | Result |
|--------|-------------|--------------|--------|
| Ledger V2 | `unified` | MR JALIL PKR 216,300 | PASS |
| Account Statement (Advanced) | `unified` | MR JALIL PKR 216,300 | PASS |
| Trial Balance | `unified` | debit = credit PKR 407,957,271.02 | PASS |
| Admin Compare Pilot Batch | — | 9/9 | PASS |

Evidence: [`phase-212x-closeout-screen-verify.md`](phase-212x-closeout-screen-verify.md)

---

## Waivers (carry forward)

| Waiver | Notes |
|--------|-------|
| Accelerated soak (2.10G / 2.11 / 2.12) | T0 + mid + final compressed; no 24h wall-clock |
| Export PDF/Excel/CSV | Manual spot-check; on-screen totals verified in QA |
| Staff-role visibility | Admin QA only (`din@yahoo.com`) |
| Preview tunnel isolation | Chunks load from production origin; preview browser QA waived |
| Historical phase reports (2.1–2.8) | Point-in-time docs retain “engine OFF at ship”; see Production Ready pack for live state |

---

## Rollback commands (L1 per screen)

**Ledger V2 loader OFF**

```sql
-- scripts/single-core-ledger/phase-210-rollback-loader-ledger-v2.sql
UPDATE feature_flags SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_loader_ledger_v2';
```

**Account Statement loader OFF**

```sql
-- scripts/single-core-ledger/phase-211-rollback-account-statement-loader.sql
```

**Trial Balance loader OFF**

```sql
-- scripts/single-core-ledger/phase-212-rollback-trial-balance-loader.sql
```

**Screen flag rollback (L2)**

| Screen | Script |
|--------|--------|
| Ledger V2 | `scripts/single-core-ledger/phase-29c-rollback-screen-ledger-v2.sql` |
| Account Statement | `scripts/single-core-ledger/phase-211-rollback-account-statement-screen.sql` |
| Trial Balance | `scripts/single-core-ledger/phase-212-rollback-trial-balance-screen.sql` |

**Engine OFF (L3 — all unified screens for DIN CHINA)**

```sql
-- scripts/single-core-ledger/phase-29c-rollback-engine.sql
```

**Preflight / postverify (read-only)**

- `scripts/single-core-ledger/phase-212x-closeout-flags.sql`
- `scripts/single-core-ledger/phase-212-preflight-trial-balance-loader.sql`

---

## 24–48 hour monitoring checklist

Run daily (or after any deploy) until 2026-06-28:

| # | Check | How | Pass criteria |
|---|-------|-----|---------------|
| 1 | MR JALIL closing | Ledger V2 + Account Statement Advanced | PKR 216,300 ± 0.01 |
| 2 | Trial Balance balance | Reports → Financial → Trial Balance, All Branches, wide period | debit = credit = PKR 407,957,271.02 |
| 3 | Main loaders | DevTools: `data-*-main-loader="unified"` on all three screens | all unified |
| 4 | Exports spot-check | PDF or Excel on Trial Balance | totals match on-screen |
| 5 | User complaints | Ops channel / support | none related to GL screens |
| 6 | RPC / console errors | Browser console + Supabase logs | no spike on unified RPCs |
| 7 | Wrong flags | Run `phase-212x-closeout-flags.sql` | only 8 DIN CHINA flags ON; no other company loaders |

**Automated helper:**

```bash
QA_BROWSER_PASSWORD='***' node scripts/single-core-ledger/run-phase-212x-closeout-verify.mjs
```

---

## Next recommended phase options (blocked until ops ticket)

Choose **one** screen for next loader rollout — do not batch:

1. **Roznamcha** — preview shipped (2.6); needs loader plan + DIN CHINA-only SQL
2. **Party Ledger** — preview shipped (2.7); needs loader plan
3. **Cash/Bank parity (2.9A-CB)** — roznamcha/Cash-Bank scope alignment before loader
4. **Other companies** — separate finance sign-off; no shared flag enablement

**Do not enable** any of the above without a new phased ticket matching 2.10/2.11/2.12 pattern.

---

## Commits referenced

| Phase | Hash |
|-------|------|
| 2.11 | `eaf83097` |
| 2.12 | `845865dc`, `a74e7d1b` |
| 2.12 evidence | `212a699f` |
