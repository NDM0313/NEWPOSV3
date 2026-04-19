# 51. Session Summary — April 19, 2026

**Status:** Major fixes across accounting, product reports, rental system.

---

## Completed Work

### Phase 1: Performance & In-Place Edit Fixes (from session 50 remaining tasks)
| Fix | Files | Status |
|-----|-------|--------|
| Debounce `loadEntries` (300ms) — 6-8x calls → 1 | AccountingContext.tsx | Done |
| Payment sync skip cache (session-level Set) | paymentAdjustmentService.ts | Done |
| Sale payment account change in-place (no adjustment JE) | saleService.ts | Done |
| Purchase payment account change in-place | purchaseService.ts | Done |
| Auto-sync account balances after edits | AccountingContext.tsx | Done |
| Void legacy adjustment JEs (Dev Lab tab M) | liveDataRepairService.ts, DeveloperIntegrityLabPage.tsx | Done |
| Stock movement consolidation (edit deltas) | SalesContext.tsx, PurchaseContext.tsx | Done |
| Expense payee reverse lookup fix | ExpenseContext.tsx, AddExpenseDrawer.tsx | Done |

### Phase 2: Purchase Edit JE Fix
| Fix | Files | Status |
|-----|-------|--------|
| Purchase JE rebuild (was doubling freight/subtotal lines) | PurchaseContext.tsx | Done |
| Rebuild purchase JE tool in Dev Lab | liveDataRepairService.ts, DeveloperIntegrityLabPage.tsx | Done |

### Phase 3: Product Stock Card Report (NEW)
| Feature | Details |
|---------|---------|
| 3-tab report | Stock Card, Profit Analysis, Source Trace |
| 15-column ledger table | Date, Voucher#, Type, Variation, Party, Qty In/Out, Cost/Sale Rate, Amount, Discount, Net, Balance, Stock Value, Profit, Remarks |
| 11 summary metrics | Purchase Qty/Value, Sale Qty/Value, Returns, Stock, Value, Profit, Avg Cost, Last Purchase/Sale Price |
| All Products view | Summary table with grand totals (stock, purchases, sales, returns, adjustments) |
| Profit Analysis tab | Customer-wise + month-wise sale/profit breakdown |
| Source Trace tab | Supplier trace, customer trace, return trace |
| Red flags / audit warnings | Negative stock, zero cost sales, duplicate movements |
| Variation column | Shows variation name/SKU for variable products |
| WAC calculation | Weighted Average Cost for profit calculation |
| Auto cost_price update | Product cost_price updates on purchase | 

### Phase 4: Rental System Fixes (10 bugs fixed)
| Fix | Files | Status |
|-----|-------|--------|
| Status enum mismatch (picked_up → active) | rentalService.ts | Done |
| Same-day availability overlap (gt → gte) | rentalAvailabilityService.ts | Done |
| Advance payment saved at booking | rentalService.ts | Done |
| Stock check before rental_out | rentalService.ts | Done |
| Document expiry validation at pickup | rentalService.ts | Done |
| Penalty > security deposit warning | rentalService.ts | Done |
| Cancel allows booked status | rentalService.ts | Done |
| Multi-item cart (was single product) | RentalBookingDrawer.tsx | Done |
| Pickup modal payment refresh | PickupModal.tsx, RentalDashboard.tsx | Done |
| Booking number (was hardcoded RENT-1001) | RentalBookingDrawer.tsx | Done |
| Book Order button enabled with cart items | RentalBookingDrawer.tsx | Done |
| Payment refresh from DB (stale context fix) | RentalDashboard.tsx | Done |

### Phase 5: Rental Accounting Fix
| Fix | Files | Status |
|-----|-------|--------|
| Rental Income → correct GL account (4200, was 4100 Sales Revenue) | AccountingContext.tsx | Done |
| Rental Expense account (5300) added to COA | defaultAccountsService.ts | Done |
| Rental expense tracking UI in booking | RentalBookingDrawer.tsx | Done |
| Expenses stored in rental record (JSONB) | rentalService.ts | Done |

---

## Remaining Tasks

### HIGH Priority
1. **Pickup modal flicker** — Payment ke baad momentarily blank hota hai phir purani amount aa jaati hai. Root cause: parent re-renders with stale rental prop before DB fetch completes. Needs: debounce parent re-render or use optimistic update.

2. **Document number per-company** — DB RPC function correct hai (`WHERE company_id = p_company_id`) but some companies may have stale `document_sequences_global` rows. Needs: audit + reset per-company sequence numbers.

3. **Rental expense GL posting** — Expense UI added but JE not yet posted automatically. Needs: Dr Rental Expense (5300), Cr Cash when expense is recorded.

### MEDIUM Priority
4. **Rental advance → income recognition** — When remaining payment collected, Rental Advance (2020) should be reversed (Dr Rental Advance, Cr Rental Income). Currently advance stays as liability even after full payment.

5. **Rental depreciation tracking** — Dress value decreases with each rental. No mechanism to track this yet.

6. **Rental reports** — No dedicated rental reports (monthly revenue, most rented products, customer frequency).

### LOW Priority
7. **Product Ledger WAC display** — User noted that WAC-based profit shows averaged cost not last purchase cost. This is correct accounting but may need UI toggle.

8. **Rental partial returns** — `returned_quantity` field exists but code ignores it. Multi-item returns need per-item condition assessment.

9. **Rental date extension** — Can't extend dates without cancel + rebook.

---

## Key Files Modified This Session

```
src/app/context/AccountingContext.tsx
src/app/context/PurchaseContext.tsx
src/app/context/SalesContext.tsx
src/app/context/ExpenseContext.tsx
src/app/services/paymentAdjustmentService.ts
src/app/services/saleService.ts
src/app/services/purchaseService.ts
src/app/services/liveDataRepairService.ts
src/app/services/defaultAccountsService.ts
src/app/services/rentalService.ts
src/app/services/rentalAvailabilityService.ts
src/app/components/reports/ProductLedger.tsx
src/app/components/reports/ReportsDashboardEnhanced.tsx
src/app/components/rentals/RentalBookingDrawer.tsx
src/app/components/rentals/PickupModal.tsx
src/app/components/rentals/RentalDashboard.tsx
src/app/components/admin/DeveloperIntegrityLabPage.tsx
src/app/components/dashboard/AddExpenseDrawer.tsx
```
