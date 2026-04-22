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

## System Status Summary

| Area | Status | Notes |
|------|--------|--------|
| **Web ERP** | Production ready | PDF preview + export, document share, audit logs, PWA, performance indexes; unified docs can open preview before print/PDF. |
| **Mobile app** | Barcode + POS + offline + accounts/reports refresh | `erp-mobile-app/` — Scan, cart, payment, sync; reports hub with preview; inventory history drill-down. |
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

**New in repo (apply when ready):** `20260422_party_subledger_rpcs_and_payment_routing.sql`, `20260423_document_posting_rpcs.sql`, `20260424_fix_purchase_received_stock_trigger.sql` — follow the same apply process; use `supabase_admin` / owner role if a function is owned by Supabase internal roles.

---

## 2. Web ERP — Optional follow-ups

- **Document share:** Preview + Download PDF + WhatsApp + Email are on `DocumentShareActions` and extended to unified ledger/receipt/quotation/proforma/packing/courier/purchase views. Any other screen that still calls raw `window.print()` only can adopt `DocumentPreviewButton` the same way.
- **Audit log:** `audit_logs` table and `auditLogService` exist; sale create is logged; payments/purchases/production can be wired the same way where needed.
- **PWA:** Installed; build and deploy as usual.

---

## 3. Mobile App — Remaining (Office)

| Task | Priority | How to complete |
|------|----------|------------------|
| **Thermal printer (hardware)** | Optional | Settings → Printer already has mode/paper size. For actual device printing, add a Capacitor plugin (e.g. Bluetooth thermal printer) and wire to receipt flow. |
| **Inventory scan (adjustment flow)** | Later | New flow: scan product → stock adjustment / recount. Reuse `features/barcode` and product API; history view already exists for read-only drill-down. |
| **Device-specific UI (e.g. Sunmi V2 Pro)** | Later | Optimise layout for that device (camera, receipt, POS speed). See `docs/MOBILE_APP_ARCHITECTURE.md`. |

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

**Last updated:** April 2026 — GitHub push with Mobile Fixes Bundle 2, web PDF preview wiring, inventory redesign + product history, `docs/COMPLETED_WORK_BUNDLE2.md`, and migration files `20260422`–`20260424` in repo.
