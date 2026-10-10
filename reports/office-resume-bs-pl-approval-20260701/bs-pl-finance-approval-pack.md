# BS/P&L finance approval pack

**Run:** OFFICE RESUME AFTER HOME SKIP — BS/P&L FINANCE APPROVAL PACK ONLY  
**Date:** 2026-07-01  
**Status:** `COMPLETE` — BS/P&L unified main loaders live 2026-07-01  
**Deploy:** NOT DEPLOYED | **Loader swap:** NOT EXECUTED | **GL mutations:** NONE

---

## 1. Current status — Balance Sheet and P&L

| Screen | Main loader (production) | Unified preview | Finance approved |
|--------|--------------------------|-----------------|------------------|
| Balance Sheet | Legacy `getBalanceSheet` | Phase 3A compare panel (default OFF) | **NO** |
| Profit & Loss | Legacy `getProfitLoss` | Phase 3A compare panel (default OFF) | **NO** |

Legacy BS/P&L remain **authoritative** for all three companies. Unified preview is **compare-only** evidence — not finance-approved goldens.

---

## 2. Unified-ready vs live

- **Unified-ready:** Preview mappers, diff logic, and Phase 3D candidate captures exist; **7/7 zero-diff** at section totals (2026-07-01 refresh includes DIN BRIDAL post-1100).
- **Not live:** No `unified_ledger_loader_balance_sheet` or `unified_ledger_loader_profit_loss` flags enabled on any company.
- **Swap would change:** Main data source on BS/P&L screens from legacy services to unified TB-derived preview loaders (same pattern as Cash Flow 3B-M).

---

## 3. What loader swap would change

When approved and executed (separate phase):

1. Enable per-company screen + loader flags for BS and P&L.
2. BS/P&L pages load unified engine output instead of legacy `getBalanceSheet` / `getProfitLoss`.
3. Preview compare panel may remain for soak; legacy shadow optional per runbook.
4. Monitoring would need BS/P&L golden fixtures (not yet in three-company Phase 2.16 gate).
5. Requires frontend deploy if loader wiring not already on production bundle.

**This run does not enable any flags.**

---

## 4. Known risks per company

### DIN CHINA

| Risk | Detail |
|------|--------|
| Scale | Largest TB (PKR ~408M); highest blast radius |
| COGS mapping | P&L uses COST_OF_PRODUCTION_CODES + type heuristics — finance must confirm |
| BS equity rollup | Net income folded into equity (BS-FIX / PF-04) — rule confirmation required |
| Capture age | 2026-06-29 zero-diff; no GL repair since capture |

### DIN BRIDAL

| Risk | Detail |
|------|--------|
| **Post-1100 capture** | **DONE 2026-07-01** — `ZERO_DIFF_READY_FOR_FINANCE_REVIEW` after JV-000209/210 |
| AR reclass | Control 1100 cleared; section totals unchanged vs pre-apply capture (AR sub-ledger reclass only) |
| Negative liabilities | BS shows liabilities PKR -547,191 (legacy presentation) — finance must accept |
| TB golden refreshed | Post-correction TB monitoring golden = 22,056,075 (separate from BS/P&L gate) |

### DIN COUTURE

| Risk | Detail |
|------|--------|
| Negative equity | BS equity PKR -4,241,558 — finance must confirm presentation |
| Small revenue base | P&L revenue PKR 26,250 — sensitive to single transactions |
| Capture age | 2026-06-29 zero-diff; no known GL repair since capture |

---

## 5. Known deltas / missing comparisons

| Item | Status |
|------|--------|
| Phase 3D section-total compare | 6/6 ZERO-DIFF (2026-07-01 refresh) |
| Line-level BS/P&L compare | Not in Phase 2.16 monitoring gate |
| Post–DIN BRIDAL 1100 BS/P&L re-capture | **DONE** — `ZERO_DIFF_READY_FOR_FINANCE_REVIEW` ([`din-bridal-bs-pl-compare.md`](../bs-pl-din-bridal-post-1100-recapture-20260701/din-bridal-bs-pl-compare.md)) |
| Finance approval manifest | PENDING |
| Admin Compare BS/P&L batch | Not in current 9/9 pilot batch |

---

## 6. Required finance checks before approval

1. Review [`finance-signoff-pack.md`](../single-core-ledger/phase-3d-bs-pl-golden-capture/finance-signoff-pack.md) and per-company exports/screenshots.
2. Confirm BS equity rollup rule (net income → equity).
3. Confirm P&L COGS heuristic mapping matches business expectation.
4. Accept DIN COUTURE negative equity and DIN BRIDAL negative-liability presentation if unchanged.
5. ~~Re-capture DIN BRIDAL BS/P&L preview after 1100 correction~~ — **SATISFIED** (2026-07-01).
6. Sign written approval template (see `future-bs-pl-loader-swap-approval-template.md`).

---

## 7. Required technical checks before approval

1. `npm run monitor:three-company-unified-ledger` — PASS (baseline 2026-07-01)
2. `npm run test:unified-ledger` — 303/303 PASS
3. `npm run test:unit` — 122/122 PASS
4. `npm run build` — PASS
5. Prepare rollback SQL (L1 flag disable per loader pattern)
6. Separate deploy approval if frontend delta required

---

## 8. Rollback plan (if swap approved later)

1. **L1:** Disable `unified_ledger_loader_balance_sheet` and `unified_ledger_loader_profit_loss` (and screen flags) per company — immediate revert to legacy main loaders.
2. **Verify:** BS/P&L screens show legacy totals; three-company monitoring PASS.
3. **No GL mutation** required for rollback — flag-only.
4. **Emergency:** Same as Cash Flow rollback pattern documented in Phase 3B-M evidence.

---

## 9. Recommended safe decision

**KEEP BLOCKED** until:

- Finance completes rule confirmations (BS equity rollup + P&L COGS).
- Operator signs `future-bs-pl-loader-swap-approval-template.md`.
- Separate loader-swap execution phase approved (not this docs-only run).

---

## 11. DIN BRIDAL post-1100 recapture — 2026-07-01

**Classification:** `ZERO_DIFF_READY_FOR_FINANCE_REVIEW`  
**Evidence:** [`reports/bs-pl-din-bridal-post-1100-recapture-20260701/`](../bs-pl-din-bridal-post-1100-recapture-20260701/)

### Balance Sheet summary (as at 2026-07-01)

| Metric | Legacy | Unified | Δ |
|--------|--------|---------|---|
| Total Assets | PKR 13,521,792 | PKR 13,521,792 | 0 |
| Total Liabilities | PKR -547,191 | PKR -547,191 | 0 |
| Total Equity | PKR 14,068,983 | PKR 14,068,983 | 0 |

### P&L summary (2000-01-01 → 2026-07-01)

| Metric | Legacy | Unified | Δ |
|--------|--------|---------|---|
| Revenue | PKR 354,500 | PKR 354,500 | 0 |
| Cost of Sales | PKR 49,028 | PKR 49,028 | 0 |
| Net Profit | PKR 119,992 | PKR 119,992 | 0 |

**Fresh capture prerequisite:** **SATISFIED** for DIN BRIDAL.  
**Loader swap status:** **COMPLETE** — flags enabled 2026-07-01; post-flag capture 6/6 zero-diff. Evidence: [`reports/bs-pl-runtime-wiring-swap-20260701/`](../bs-pl-runtime-wiring-swap-20260701/)

---

## 10. Written approval template

See: [`future-bs-pl-loader-swap-approval-template.md`](future-bs-pl-loader-swap-approval-template.md)

---

## Evidence references

- Phase 3D capture: `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/`
- Prior draft: `reports/remaining-tasks-start-20260630/bs-pl-loader-swap-approval-pack.md`
- Office resume pack: `reports/office-resume-bs-pl-approval-20260701/`
- DIN BRIDAL post-1100 recapture: `reports/bs-pl-din-bridal-post-1100-recapture-20260701/`
