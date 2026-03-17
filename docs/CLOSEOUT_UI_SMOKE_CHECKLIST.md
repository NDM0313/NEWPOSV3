# Closeout — Manual UI Smoke Checklist

Run a short click-through with the app running (local or deployed).

## NEW BUSINESS (primary)

1. **Dashboard** — Opens; cards load or show empty state.
2. **Sales** — List opens; create new sale does not crash.
3. **Purchases** — List opens; create new purchase does not crash.
4. **Accounting** — Accounting page opens; tabs (Journal, Daybook, Roznamcha, Accounts, Ledger, Receivables, Payables, **Courier**, etc.) open.
5. **Rental** — Rental dashboard/list opens.
6. **Studio** — Studio list/dashboard opens.
7. **Accounting → Courier tab** — Courier Reports / shipment view opens.
8. **Reports** — Reports page opens; at least one report (e.g. Trial Balance, P&L) opens.

**Check:** Empty states look correct; no crash on core create/view; permissions (e.g. Staff vs Admin) behave as expected.

## OLD BUSINESS (regression)

1. **Accounting** — Opens.
2. **Reports** — Opens.
3. **Courier** (via Accounting) — Opens.
4. **Rental** — Opens.
5. **Studio** — Opens.

**Check:** No major regression; no broken route or module.

---

If all above pass with no blocker, proceed to go-live.
