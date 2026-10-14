# Cash Flow parity contract — Phase 3B

**Status:** PREVIEW_ONLY — not finance approved  
**Generated:** 2026-06-29T14:00:00.000Z

---

## Scope

Compare legacy `getCashFlowReport` summary vs unified cash/bank ledger preview mapped through Cash Flow logic. **Does not replace main loader.**

---

## Contract rules

| Rule | Specification |
|------|---------------|
| Accounting basis (normal) | `effective_party` — matches legacy normal mode |
| Accounting basis (audit) | `audit_full_history` — matches audit toggle |
| Date range | Same `dateFrom` / `dateTo` as legacy load |
| Branch | Same `effectiveBranchId` as legacy |
| Liquidity filter | Same `accountFilter` (`all`/`cash`/`bank`/`wallet`) |
| Payment account filter | Same `paymentLedgerAccountId` |
| Source module filter | Same `sourceModuleFilter` applied to preview rows |
| Normal visibility | Unified RPC basis excludes voided/reversal in normal mode |
| Audit visibility | Audit mode includes voided/reversal per unified basis |
| Correction/reversal | Legacy uses `resolveCashFlowRowStatus`; preview relies on unified basis filtering |
| Running balance | Compare summary totals (opening, cash in/out, net, closing); row-level running balance not required for pass |
| Currency | PKR company currency via `useFormatCurrency` |
| Export/print | Legacy export unchanged; preview offers JSON compare export |
| Preview-only fallback | If kill switch active, preview blocked with message; legacy remains |
| Golden capture | Required for DIN CHINA / DIN BRIDAL / DIN COUTURE before any loader swap — **not invented in this phase** |

---

## Compare fields

- Opening balance
- Cash in
- Cash out
- Net movement
- Closing balance
- Row count (informational)

---

## Explicit non-goals

- No Cash Flow loader flag creation
- No adoption of unified totals as official
- No change to roznamchaService main path
