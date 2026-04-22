# Remaining Tasks — Office Completion Guide

**Purpose:** List of what is done, what remains, and how to complete remaining items so the office can finish the system.

---

## Recently completed (April 2026 — Mobile Fixes Bundle 2)

The following was implemented and is reflected on `main` (see commit message on GitHub):

| Area | What shipped |
|------|----------------|
| **Mobile — sales & cart** | Product tile images; packing gated by `enable_packing`; quantity/summary state fixes; shipping card removed from summary. |
| **Mobile — purchases** | Order vs Received picker; DB trigger fix for `received`/`final` stock (`20260424_fix_purchase_received_stock_trigger.sql`). |
| **Mobile — PDF** | Preview modal before share/download/print for reports and payment receipts (`html2canvas` + branded header). |
| **Mobile — inventory** | Redesigned inventory screen; tap product → **Product history** with movements, running balance, PDF preview. |
| **Web — PDF** | Shared `PdfPreviewModal`, `DocumentPreviewButton`, preview on `DocumentShareActions` and unified document views + day book / account ledger entry points. |
| **RPCs / accounting (repo)** | Party subledger + document posting migrations present in `migrations/` — apply with your usual Supabase/VPS process. |

**Detail:** `docs/COMPLETED_WORK_BUNDLE2.md`

---

## Recently completed (April 2026 — Mobile sprint: polish + reports + studio + rental + PIN)

The following shipped in this sprint (mobile-first; some web touchpoints for audit/print). Commit on GitHub documents the full diff.

| Area | What shipped |
|------|----------------|
| **Polish** | Ledger PDF date column width; day book row in/out colours; general entry bottom button layout when nav hidden. |
| **PIN** | Permanent lock on resume/relaunch via `pinLock`; settings flow with `SetPinModal`; dev bypass removed from `LoginScreen`. |
| **Reports** | `TransactionDetailSheet` + `transactionDetail` / `users` APIs; tap row on Sales / Purchase / Expense / Account & Party ledger / Day book → detail sheet. |
| **Ledger / day book** | Sort by date+time; weekly/monthly grouping with closing-balance subtotal rows; Roznamcha-style cash-only filter + hub tile label. |
| **Hub reports** | `StudioReport`, `RentalReport`, `InventoryReport` wired to real data (studio orders/steps/workers; rental items/payments/returns; product/variation picker + movement drill-down). |
| **Studio** | After studio sale → focus studio module; stage draft persistence on back; worker list filtered by specialization; default rate prefill; customer charge = worker cost × (1 + profit %). |
| **Rental** | List/detail dates fixed; `CreateRentalFlow` parity (multi-line qty + variation, salesman + commission, advance, NSC docs); `rentals` API extensions; DB: `migrations/20260423_rental_items_variation_id.sql` (`rental_items.variation_id`). |
| **Payments** | `UnifiedPaymentSheet` for sale / purchase / rental receive paths; duplicate `reference_number` avoided (nullable `p_reference_number` so DB can generate). |
| **Web (small)** | `ReportActions` / `RoznamchaReport` / `ClassicPrintBase` / invoice & PO print layouts; audit hooks on payments, purchases, production orders (`saleService`, `supplierPaymentService`, `purchaseService`, `productionOrderService`, `addEntryV2Service`, `AccountingContext`, `auditLogService`). |

**Build:** `cd erp-mobile-app && npm run build` passes (TypeScript); ship with `npm run build:mobile && npx cap sync` for store builds.

---

## System Status Summary

| Area | Status | Notes |
|------|--------|--------|
| **Web ERP** | Production ready | PDF preview + export, document share, audit logs, PWA, performance indexes; unified docs can open preview before print/PDF. |
| **Mobile app** | Barcode + POS + offline + accounts/reports + studio/rental depth | `erp-mobile-app/` — PIN lock, unified payment sheet, report drill-down, ledger grouping / Roznamcha filter, studio & rental flows aligned closer to web. |
| **Inventory engine** | Complete | Single source of truth = `stock_movements`; see `docs/ERP_INVENTORY_FINAL_REPORT.md`, `npm run inventory-validate` |
| **Migrations** | Auto-apply in place | `npm run migrate` or `npm run migrate -- --allow-fail` |
| **feature_flags** | Fixed & applied | Migration now resilient (skips if not table owner) |
| **final_web_erp_performance_indexes** | Applied | sales_items, sales, production_orders (if table exists) |

---

## 1. Migrations (SQL Auto-Apply)

**Command (from repo root):**
```bash
npm run migrate
# or if one migration may fail (e.g. ownership):
npm run migrate -- --allow-fail
```

**Env:** Set in `.env.local`:
- `DATABASE_URL` or `DATABASE_POOLER_URL` — for normal apply
- `DATABASE_ADMIN_URL` — postgres/superuser URL if you need to fix "must be owner" errors

**If a migration fails with "must be owner":**
- Either run that migration file manually in Supabase SQL Editor as a user that owns the object (e.g. postgres), or
- Add the same resilient pattern used in `feature_flags_table.sql`: wrap the failing part in  
  `DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END $$;`  
  so the script completes and the rest of the migrations run.

**Currently known:** `financial_dashboard_metrics_rpc.sql` may fail with "must be owner of function". Use `--allow-fail` or run that file as postgres and insert its name into `schema_migrations` so it is not re-run.

**New in repo (apply when ready):** `20260422_party_subledger_rpcs_and_payment_routing.sql`, `20260423_document_posting_rpcs.sql`, `20260423_rental_items_variation_id.sql` (rental line `variation_id`), `20260424_fix_purchase_received_stock_trigger.sql` — follow the same apply process; use `supabase_admin` / owner role if a function is owned by Supabase internal roles.

---

## 2. Web ERP — Optional follow-ups

- **Document share / preview:** `DocumentPreviewButton` + `ClassicPrintBase.documentPreview`, invoice/purchase print layouts, and `ReportActions` (with preview ref) extend preview-first UX; some legacy screens (expenses, settings print tests, studio, etc.) may still use raw print only — adopt the same pattern when touching those files.
- **Audit log:** Shipped: `auditLogService.logPaymentCreated` / purchase / manufacturing `production_orders` audits on create/update/delete/cancel/restore paths (`saleService`, `supplierPaymentService`, `addEntryV2Service`, `AccountingContext`, `purchaseService`, `productionOrderService`). Studio `studio_productions` tables are not in `audit_logs` entity list yet (optional follow-up).
- **PWA:** Installed; build and deploy as usual.

---

## 3. Mobile App — Remaining (Office)

| Task | Priority | Notes |
|------|----------|--------|
| **On-device QA** | High before store | Exercise PIN cold start + background, all report drill-downs, studio sale → studio tab, rental create + payment + return, unified payment on real hardware; confirm migration `20260423_rental_items_variation_id.sql` applied on production DB. |
| **Thermal Bluetooth (hardware)** | Optional | **Done in repo (abstraction):** `erp-mobile-app/src/services/thermalPrint.ts` (ESC/POS encode + `window.ThermalPrinter.write` bridge), **Thermal print (Bluetooth)** on sale success modal when Settings → printer mode is thermal; shows hint until a native plugin exposes the bridge or Sunmi SDK. |
| **Inventory scan → adjust** | Done (code) | Inventory header **Scan** → barcode → `StockAdjustmentSheet` (add/subtract/set); **Adjust** on product history; API `createStockAdjustment` in `erp-mobile-app/src/api/inventory.ts`. |
| **Device-specific UI (e.g. Sunmi V2 Pro)** | Later | Optimise layout for that device (camera, receipt, POS speed). See `docs/MOBILE_APP_ARCHITECTURE.md`. |
| **Legacy screens → PDF preview** | Optional | Match web pattern (`DocumentPreviewButton` / print base) on any mobile screens still opening raw print only when you touch them. |

---

## 4. Repo and Deploy

- **Git:** Push `main` to GitHub after local commit; see `docs/COMPLETED_WORK_BUNDLE2.md` for this bundle’s scope.
- **Deploy web:** Build with `npm run build`; deploy `dist/` to your host. Ensure env (e.g. Supabase URL/keys) is set on server.
- **Deploy mobile:** In `erp-mobile-app/`, run `npm run build:mobile && npx cap sync`, then open Android/iOS project and build/store as usual.

---

## 5. Key Files for Reference

| Doc | Purpose |
|-----|--------|
| `docs/ERP_DEVELOPMENT_ROADMAP.md` | Full roadmap, order of steps, migration safety, mobile priority |
| `docs/ERP_INVENTORY_FINAL_REPORT.md` | Inventory engine status, schema, triggers, health, web/mobile sync |
| `docs/MOBILE_APP_ARCHITECTURE.md` | Mobile structure, barcode, POS, offline, printer |
| `docs/REMAINING_TASKS.md` | This file — what’s left for office |
| `docs/COMPLETED_WORK_BUNDLE2.md` | What was completed in Mobile Fixes Bundle 2 + related web/migrations |

---

## 6. Quick Commands

```bash
# From repo root
npm install
npm run migrate -- --allow-fail   # apply SQL
npm run build                     # web build

# Mobile
cd erp-mobile-app
npm install
npm run build:mobile && npx cap sync
npx cap open android   # or ios
```

---

**Last updated:** 23 April 2026 — Mobile sprint (PIN, `TransactionDetailSheet`, ledger grouping + Roznamcha filter, studio/rental/inventory reports, `CreateRentalFlow` + `variation_id` migration, `UnifiedPaymentSheet`, studio workers/profit %) documented above; push to GitHub after local commit.
