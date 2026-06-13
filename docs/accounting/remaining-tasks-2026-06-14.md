# Remaining tasks — 14 Jun 2026

**Latest session doc:** [`../2026-06-14-RENTALS-REPORTS-KPI-SESSION.md`](../2026-06-14-RENTALS-REPORTS-KPI-SESSION.md)

**Prior backlog:** [`remaining-tasks-2026-06-12.md`](remaining-tasks-2026-06-12.md) (AR/AP, Control 1100, mobile rental sub-ledger)

---

## Priority — verify after push / VPS deploy

### Rentals (14 Jun)

- [ ] List + Calendar load all rentals (context `fetchRentalsForList`, not empty while Reports has data)
- [ ] KPI strip: Total Rental (Month), Amount Due show values; compact `1K`/`1M` when cell narrow; hover = full amount
- [ ] Pickup/Return empty copy when queue empty but active rentals exist
- [ ] Reports tab chart hover (dark cursor) + revenue KPI grid

### KPI compact currency (14 Jun)

- [ ] Spot-check Sales, Purchases, Inventory, Accounting, Reports dashboard MetricCards at ~1250px width
- [ ] Confirm tables / payment dialogs still show **full** currency (not compact)

### Reports / navigation (13–14 Jun bundle)

- [ ] Product Reports page; pie charts no overlap
- [ ] Customers & Suppliers Due (GL) + Advance (GL)
- [ ] Remaining Balance report; Sales Profit branch filter

### Accounting

- [ ] Journal Hygiene → **Remove from live GL** (admin) — see [`transaction-cancel-guide.md`](transaction-cancel-guide.md)
- [ ] Control 1100 effective view + variance breakdown (carry-forward from 12–13 Jun)

---

## Mobile

- [ ] Rental AR sub-ledger on mobile booking flow
- [ ] APK rebuild if needed (`erp-flutter-app` / `erp-mobile-app`)

---

## Diagnostics (VPS)

```bash
ssh dincouture-vps 'docker exec -i supabase-db psql -U postgres -d postgres' \
  < scripts/sql/diag_rental_1100_leakage.sql

ssh dincouture-vps 'docker exec -i supabase-db psql -U postgres -d postgres' \
  < scripts/sql/diag_ar_ap_variance.sql
```

Expected rental leakage: **eligible 0**, **corrected 4** (unless new data posted).
