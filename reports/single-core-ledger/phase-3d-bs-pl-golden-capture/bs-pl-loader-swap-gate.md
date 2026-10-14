# BS/P&L loader swap gate — Phase 3D

**Status:** `BLOCKED`  
**Generated:** 2026-06-29T12:00:00.000Z

> Future Balance Sheet and Profit & Loss **loader swap is blocked** until every gate below is satisfied. Finance sign-off pack preparation does **not** satisfy these gates.

---

## Gate checklist

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | Finance approval manifest is **APPROVED** | BLOCKED | Template at [`finance-approval-manifest-template.json`](finance-approval-manifest-template.json); current status **PENDING** |
| 2 | Accounting rule confirmations accepted | BLOCKED | BS equity rollup + P&L COGS heuristic |
| 3 | Optional additional monitoring / soak passes | NOT STARTED | Per-company browser QA after approval |
| 4 | Separate operator approval to create loader flags / swap plan | BLOCKED | No `unified_ledger_loader_balance_sheet` or `unified_ledger_loader_profit_loss` flags |
| 5 | Rollback plan created | NOT STARTED | L1 rollback SQL per loader pattern |
| 6 | Tests / build pass | PASS (baseline) | Re-run before any swap execution |
| 7 | Deploy plan approved | NOT STARTED | No deploy in sign-off phase |

---

## What remains live today

- Legacy `getBalanceSheet` / `getProfitLoss` are **main loaders**
- Phase 3A preview compare is **preview-only**, toggle default **OFF**
- Five approved unified loaders per company unchanged (Ledger V2, Account Statement, TB, Party Ledger, Roznamcha)

---

## Also blocked (unchanged)

- **R7** — design-only
- **R8** — legacy engine retirement blocked
- **Next company** — blocked until separate finance sign-off

---

## Reference

- Candidate goldens: [`finance-signoff-pack.md`](finance-signoff-pack.md)
- Diff analysis: [`diff-analysis.md`](diff-analysis.md)
- Per-company rollout pattern: [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md)
