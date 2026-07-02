# Release Notes — 2026-06-13

Session bundle: **Duplicate Product**, **Rental Bill Ref parity**, **SalesHome Rental tab**, **Reports Sales fixes**, **Accounting diagnostics hub**, and related migrations.

---

## 1. Duplicate Product (web + mobile)

### Web
- Products list ⋮ menu → **Duplicate Product**
- Opens Add Product drawer pre-filled; saves as **new** product (new SKU, stock 0, name ` (Copy)`)
- Files: `src/app/utils/productDuplicateUtils.ts`, `EnhancedProductForm.tsx`, `NavigationContext.tsx`, `GlobalDrawer.tsx`, `ProductsPage.tsx`

### Mobile (`erp-mobile-app`)
- Product detail → **Duplicate Product**; `AddProductFlow` duplicate mode
- Files: `erp-mobile-app/src/utils/productDuplicateUtils.ts`, `AddProductFlow.tsx`, `ProductsModule.tsx`, `ProductDetailSheet.tsx`

---

## 2. Rental Bill Ref & pickup fix (web + mobile)

### Problem fixed
Web pickup was writing guarantee ID into `rentals.document_number`, overwriting mobile **manual bill ref**. Mobile uses `security_document_*` for pickup ID.

### Web
- **RentalBookingDrawer:** Bill / manual ref # input; persisted to `document_number` on create
- **rentalService:** `updateRentalMeta()`, pickup uses `security_document_*` (no bill ref clobber)
- **RentalsPage:** Bill # column + search
- **ViewRentalDetailsDrawer:** Bill display/edit; payment rows show `Ref: RCV-*`

### Mobile
- **ViewRentalDetails:** Payment history matches SalesHome style (amount, method • date, Ref, notes)
- **rentals API:** Enriches payments via `journal_entry_id` → `payments.reference_number`
- **SalesHome:** **Rental** filter tab; **All** tab mixes sales + rentals; stats include rentals

---

## 3. Reports — Sales tab accuracy

- Dedicated `getSalesForReports()` (date range, up to 5000 rows)
- Lifecycle filters: operational, final_only, orders, cancelled, all
- Fixed 400 Bad Request (removed invalid columns `type`, `shipment_status`, `shipping_status`)
- GL cancelled sale labels in Accounting dashboard
- Files: `ReportsDashboardEnhanced.tsx`, `saleService.ts`, `reportsSalesLogic.ts`

---

## 4. Accounting diagnostics hub (two-tier)

- AR/AP diagnostics consolidation under Accounting
- Customers & Suppliers report with GL due/advance columns
- Balance basis guide, trial balance journal search, nav deep links
- New migrations (apply on VPS if not already):

| Migration | Purpose |
|-----------|---------|
| `20260613150000_get_customers_suppliers_report.sql` | C&S report RPC |
| `20260621120000_drop_duplicate_party_gl_balances_overload.sql` | Drop duplicate RPC overload |
| `20260622120000_customers_suppliers_report_gl_due.sql` | GL due column |
| `20260623120000_customers_suppliers_report_advance_gl.sql` | GL advance column |

---

## 5. Deploy status (2026-06-14)

| Step | Status |
|------|--------|
| GitHub pull (local + VPS → `815bf7fe`) | Done |
| VPS migrations (`run-migrations-vps.sh`) | Done — all applied |
| VPS ERP rebuild (`vps-build-erp-only.sh`) | Done — `erp-frontend` restarted |
| Web + mobile production builds | Done |
| Android debug APK (`android:debug:win`) | Done — `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` |

**Live:** https://erp.dincouture.pk/ — hard refresh (Ctrl+Shift+R) after deploy.

### Manual QA checklist (you verify in browser / device)
- [ ] Web: Duplicate product → one new row only
- [ ] Web: Rental booking with bill ref → list Bill # → pickup preserves bill ref
- [ ] Mobile: SalesHome All + Rental tabs; rental payment Ref lines
- [ ] Reports → Sales loads data (no 400); lifecycle filters correct

**Also see:** [`docs/accounting/remaining-tasks-2026-06-14.md`](accounting/remaining-tasks-2026-06-14.md) for 14 Jun rentals/reports KPI backlog.

---

## 6. Out of scope (not in this bundle)

- `erp-flutter-v2/` — separate tree; not included in this commit
- Web SalesPage POS/Regular/Rental tabs (mobile SalesHome only)
