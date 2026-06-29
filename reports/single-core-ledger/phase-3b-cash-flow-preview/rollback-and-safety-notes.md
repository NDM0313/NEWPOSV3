# Rollback and safety notes — Phase 3B

**Generated:** 2026-06-29T14:00:00.000Z

---

## Rollback (if preview causes issues)

1. **UI-only rollback:** Revert `CashFlowReportPage.tsx` + preview panel files — legacy CF unaffected
2. **No DB rollback needed** — no migrations or flags
3. **No GL rollback needed** — read-only preview path

---

## Safety guarantees

- `getCashFlowReport` unchanged
- `roznamchaService.getRoznamcha` unchanged
- Preview toggle default OFF
- Kill switch blocks preview only
- No `unified_ledger_loader_cash_flow` flag exists

---

## Production blast radius

Low — preview visible only to admin/developer/integrity-lab roles when deployed.
