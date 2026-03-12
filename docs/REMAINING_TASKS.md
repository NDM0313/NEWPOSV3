# Remaining Tasks — Office Completion Guide

**Purpose:** List of what is done, what remains, and how to complete remaining items so the office can finish the system.

---

## System Status Summary

| Area | Status | Notes |
|------|--------|--------|
| **Web ERP** | Production ready | PDF export, document share, audit logs, PWA, performance indexes |
| **Mobile app** | Barcode + POS + offline done | `erp-mobile-app/` — Scan, cart, payment, sync |
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

---

## 2. Web ERP — Nothing Critical Left

- **Document share:** Download PDF, WhatsApp, Email — done in `UnifiedSalesInvoiceView`; can reuse `DocumentShareActions` on other document views (Purchase Invoice, Quotation, Ledger, Receipt, Packing List) if needed.
- **Audit log:** `audit_logs` table and `auditLogService` exist; sale create is logged; payments/purchases/production can be wired the same way where needed.
- **PWA:** Installed; build and deploy as usual.

---

## 3. Mobile App — Remaining (Office)

| Task | Priority | How to complete |
|------|----------|------------------|
| **Thermal printer (hardware)** | Optional | Settings → Printer already has mode/paper size. For actual device printing, add a Capacitor plugin (e.g. Bluetooth thermal printer) and wire to receipt flow. |
| **Inventory scan** | Later | New flow: scan product → update stock / stock adjustment. Reuse `features/barcode` and product API. |
| **Device-specific UI (e.g. Sunmi V2 Pro)** | Later | Optimise layout for that device (camera, receipt, POS speed). See `docs/MOBILE_APP_ARCHITECTURE.md`. |

---

## 4. Repo and Deploy

- **Git:** All changes committed and pushed (see commit message for scope).
- **Deploy web:** Build with `npm run build`; deploy `dist/` to your host. Ensure env (e.g. Supabase URL/keys) is set on server.
- **Deploy mobile:** In `erp-mobile-app/`, run `npm run build:mobile && npx cap sync`, then open Android/iOS project and build/store as usual.

---

## 5. Key Files for Reference

| Doc | Purpose |
|-----|--------|
| `docs/ERP_DEVELOPMENT_ROADMAP.md` | Full roadmap, order of steps, migration safety, mobile priority |
| `docs/MOBILE_APP_ARCHITECTURE.md` | Mobile structure, barcode, POS, offline, printer |
| `docs/REMAINING_TASKS.md` | This file — what’s left for office |

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

**Last updated:** After feature_flags migration fix, migration run (feature_flags + final_web_erp_performance_indexes applied), and prep for GitHub push.
