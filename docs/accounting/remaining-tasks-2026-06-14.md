# Remaining tasks — 14 Jun 2026

**Latest session doc:** [`../2026-06-14-RENTALS-REPORTS-KPI-SESSION.md`](../2026-06-14-RENTALS-REPORTS-KPI-SESSION.md)

**Prior backlog:** [`remaining-tasks-2026-06-12.md`](remaining-tasks-2026-06-12.md) (AR/AP, Control 1100, mobile rental sub-ledger)

**Sync status (15 Jun 2026):** Local + VPS at `main` **`bc23b89a`** (+ pending commit for financial audit lib fix). Migrations through `20260615120000_log_sale_attachment_activity.sql` on VPS; `erp-frontend` healthy. No frontend deploy for migration-only work.

---

## DIN CHINA legacy import — completed (15 Jun)

| Step | Status | Commit / note |
|------|--------|----------------|
| Legacy import (34 sales, payments, purchase, expenses) | Done | `d518279a` |
| COA cleanup (DC codes → numeric, parents) | Done | `9ddf45f4` |
| Stock movement backfill (63 sale OUT + 16 purchase IN) | Done | `a917fc78` |
| Screenshot discount backfill (AZIZ, SHAHURKH, LAL + GL 5200) | Done | `bc23b89a` |
| Financial integrity audit tooling | Dry-run OK | Reports under `DIN CHINA/03_dry_run_reports/` |

**Open (DIN CHINA — not blocking ERP use):**

- Phase 2 COGS: 12 products missing `cost_price` — set costs before COGS/inventory relief apply
- Phase 3 purchase total vs updated CSV (~Rs 464,071 delta) — business approval required
- Phase 6 sell returns — optional import when return amounts locked
- Opening balance / fabric stock from Oct 2023 — excluded by design

**Verify in UI:** `din@yahoo.com` → DIN CHINA → Reports → Stock Ledger by Product; Customers & Suppliers discount column **Rs 148,818** total.

---

## Priority — verify after push / VPS deploy

### Rentals (14 Jun)

- [x] List loads bookings + KPI strip non-zero
- [ ] **REN-0005 / Amount Due KPI:** July pickup **15,000** vs list filter; Collections badge **1** — KPI **Amount Due** still **Rs. 0.00**
- [x] Calendar / Availability — June 2026
- [x] Pickup / Return empty states
- [x] Reports tab revenue KPI grid

### KPI compact currency (14 Jun)

- [x] Accounting dashboard MetricCards compact
- [x] Rentals KPI compact
- [x] Reports operational overview full currency
- [ ] Sales / Purchases / Inventory KPI strips — not spot-checked

### Reports / navigation

- [x] Financial tab navigation
- [x] Stock Ledger by Product loads
- [ ] Product Reports pie overlap — not re-checked
- [ ] Customers & Suppliers **Due (GL)** / **Advance (GL)** — table not fully loaded in QA

### Accounting

- [x] AR/AP Diagnostics → Journal hygiene tab
- [x] Variance breakdown on Overview (DIN BRIDAL)

### Expenses (`32153d92`)

- [x] Add Expense receipt file input + bucket migration
- [ ] End-to-end receipt upload + edit-without-duplicate — no new test EXP posted

---

## Mobile

- [ ] Rental AR sub-ledger on mobile booking flow
- [ ] APK rebuild if needed

---

## Still open (not blocking web deploy)

- Control 1100 **-136,500** (DIN BRIDAL) — business decision
- **REN-0005** list filter vs Amount Due KPI
- Mobile rental AR E2E + optional APK rebuild
- Optional: `scripts/cleanup-duplicate-expenses.sql` — review SELECT before APPLY
