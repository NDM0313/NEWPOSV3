# Session work — 14 Jun 2026

**Branch target:** `main`  
**Themes:** Rentals list/calendar reliability, rental ops tabs, reports UX, system-wide KPI compact currency (1K / 1M), accounting/report polish.

---

## Completed today

### 1. Rentals — empty list / calendar fix

| Area | Change |
|------|--------|
| **Service** | `fetchRentalsForList()` in `rentalService.ts` — proven join select, no fragile `{ count: 'exact' }` on main query; flat fallback + batch enrichment on join failure |
| **Mapping** | `mapRentalRowsSafe()` in `rentalUiMapper.ts`; shared types in `rentalTypes.ts` |
| **Context** | `RentalContext` uses reliable fetch, `loadFailed`, pagination guard |
| **List UX** | `RentalsPage` — date filter includes undated rows under **From start**; empty/retry states |
| **Queues** | `rentalQueueUtils.ts` — pickup/return/collections client filters; enum-safe statuses |
| **Pickup / Return** | Contextual empty state (“X active rentals — none due today”) + **View all rentals** |
| **Reports tab** | Dark Recharts tooltip cursor; KPI typography fix |

### 2. System-wide KPI compact currency

| Area | Change |
|------|--------|
| **Formatter** | `formatCurrencyCompact()` + `formatAmountCompact()` in `formatCurrency.ts` (Intl K/M/B) |
| **Hook** | `useFormatCurrency()` exports `formatCurrencyCompact` |
| **Component** | `AdaptiveCurrencyValue` — full amount when it fits; compact on overflow; hover shows full value |
| **Rollout** | Rentals, Reports dashboard, Sales/Purchases, Inventory, Accounting, Business Health grid, Modern Summary Cards, rental queue KPIs |
| **Cleanup** | Removed ad-hoc `₹{(x/1000).toFixed(0)}k` in `RentalOrdersList` |
| **Tests** | `formatCurrency.compact.test.ts` |

### 3. Reports & navigation (prior session, in this bundle)

- Pie chart overlap fix; Expenses filters; Inventory Valuation nil SKU; Sales Profit branch filter
- Sidebar Accounting / Inventory groups; `ProductReportsPage`, `PaymentStatusDonutChart`
- Customers & Suppliers report columns/export; Remaining Balance report tweaks
- Balance Basis Guide, Trial Balance journal search, P&L/Balance Sheet polish

### 4. Accounting / integrity (in this bundle)

- Journal Hygiene **Remove from live GL** (stale correction reversal policy)
- Transaction detail modal cancel rules; integrity lab/service updates
- `transaction-cancel-guide.md` for admin self-service void

### 5. Contacts / ledger

- Removed duplicate `ContactLedgerDrawer`; statement center v2 deep links
- Contacts page routing aligned with ledger statement center

---

## Files added (high signal)

```
src/app/types/rentalTypes.ts
src/app/lib/rentalUiMapper.ts
src/app/lib/rentalQueueUtils.ts
src/app/components/shared/AdaptiveCurrencyValue.tsx
src/app/utils/formatCurrency.compact.test.ts
src/app/lib/staleCorrectionReversalPolicy.ts
src/app/components/reports/ProductReportsPage.tsx
src/app/components/reports/PaymentStatusDonutChart.tsx
docs/accounting/transaction-cancel-guide.md
```

---

## Remaining tasks

### Verify on web (after deploy)

- [ ] **Rentals → List**: shows all bookings (same count as Reports); KPI strip non-zero
- [ ] **Rentals → Calendar**: booking bars visible
- [ ] **Rentals → Collections**: REN-0005 / outstanding still listed
- [ ] **Rentals → Pickup/Return**: empty when nothing due today, with “active rentals” message
- [ ] **Rentals → Reports chart**: dark hover band; currency KPIs not clipped; narrow cells show `Rs. 150K` with full amount on hover
- [ ] **Reports dashboard**: MetricCards compact correctly on narrow layout
- [ ] **Sales / Purchases / Inventory / Accounting** KPI strips: large amounts compact when cell is narrow

### Rentals / mobile

- [ ] End-to-end: new rental booking posts to **AR-CUS*** sub-ledger (not 1100) on web + mobile after fail-closed migration
- [ ] Rebuild mobile APK if rental write path needs field verification (`erp-flutter-app`, `erp-mobile-app`)

### Control 1100 / AR-AP (unchanged from 12–13 Jun)

- [ ] Production QA: Effective ledger, Inayat party AR, variance breakdown, Hybrid Repair queue
- [ ] Review JE-0155/0157 on control 1100 (-136,500 net) — reclass vs repair vs visibility contract
- [ ] Repeat diagnostics: `scripts/sql/diag_rental_1100_leakage.sql`, `scripts/sql/diag_ar_ap_variance.sql`

### Optional engineering

- [ ] Server RPC `get_control_ar_gl_ledger` if client-side 1100 pairing is slow
- [ ] Extend `AdaptiveCurrencyValue` to Products page KPI strip if truncation reported there
- [ ] Run `node --test src/app/utils/formatCurrency.compact.test.ts` in CI once tsx/strip-types runner is wired

### Out of scope (policy)

- No destructive migrations, GL trigger changes, or auth/mobile URL changes without explicit approval

---

## Deploy notes

```bash
git pull origin main
# apply any pending migrations under migrations/ on VPS
bash deploy/vps-build-erp-only.sh   # or full deploy per your usual flow
```

Hard refresh browser after frontend rebuild.

---

## Not committed (intentionally)

- `downloads/mistake sql` — local scratch SQL, not for repo
- `erp-flutter-app/releases/*.apk` — binary artifact; ship via release channel, not git
