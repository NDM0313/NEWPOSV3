---
title: Mobile ERP Round 3 Completion Plan
purpose: Finalize user-reported blockers and remaining UX/reporting gaps
branch: main
status: pending_execution
related_commits:
  - 2645934 fix(mobile+web): harden runtime DB compatibility and worker sub-ledger posting
  - 5c258a6 chore(git): ignore temporary migration probe SQL files
---

# Mobile ERP Round 3 Completion Plan

This is the canonical working checklist for completing the remaining Round 3 items from home/office.

## Scope Summary

- Payment duplicate reference failures and sequence refresh.
- Rental payment runtime compatibility (`column "total" does not exist`).
- Sale Return partial-item quantity behavior.
- Sales/Purchase 3-dot in-app actions (no `VITE_APP_URL` dependency, no new tab).
- Reports data flow and rendering fixes (studio/customer/supplier/inventory/rental, UUID display, in/out pattern).
- Light redesign alignment for Sales list and Accounts module.
- Web user access audit cleanup.
- Deploy + smoke verification on VPS.

## Phase A - P0 Runtime/Data Blockers

- [ ] **A1 Payment duplicate reference race**
  - Files: `erp-mobile-app/src/api/sales.ts`, `erp-mobile-app/src/api/rentals.ts`, `erp-mobile-app/src/api/accounts.ts`
  - DB checks: `migrations/20260450_record_customer_payment_reference_retry.sql`
  - Action: ensure DB-side atomic allocation/retry and remove risky client-side pre-allocation.

- [ ] **A2 Rental payment `total` runtime error**
  - File: `migrations/20260453_record_payment_with_accounting_rental_compat_and_stock_variation_fk.sql`
  - Action: verify live function body and any helper/trigger still referencing `total`.

- [ ] **A3 Sale Return zero-qty on partial return**
  - Files: `erp-mobile-app/src/components/sales/SaleReturnModal.tsx`, `erp-mobile-app/src/api/sales.ts`
  - DB: `migrations/20260451_finalize_sale_return_sales_items_fallback.sql`
  - Action: confirm candidate qty mapping and partial item return validation.

- [ ] **A4 Sequence refresh (old data realignment)**
  - Script: `scripts/sql/repair_payment_sequence_to_max.sql`
  - Action: run payment sequence repair; if needed extend to all document prefixes and apply on VPS.

## Phase B - Sales/Purchase 3-Dot In-App Actions

- [ ] **B1 Sales 3-dot menu complete**
  - File: `erp-mobile-app/src/components/sales/SalesHome.tsx`
  - Must include and work: Payment History, Add Payment, WhatsApp share, PDF/Print/Download in-app, Edit, Return, Cancel.
  - Remove dependence on `VITE_APP_URL` fallback errors/new-tab behavior.

- [ ] **B2 Purchase 3-dot menu complete**
  - File: `erp-mobile-app/src/components/purchase/PurchaseModule.tsx`
  - Must include and work: View/History, Add Payment, WhatsApp share, PDF/Print/Download in-app, Edit, Return, Cancel.
  - Remove dependency that opens external/new tab.

## Phase C - Reports Data + UX Integrity

- [ ] **C1 Studio relationship ambiguity**
  - File: `erp-mobile-app/src/api/reports.ts`
  - Fix style: split-query for productions and stages, then merge client-side.

- [ ] **C2 Customer/Supplier empty list**
  - Files: report data APIs + party report screens.
  - Action: fix filters/RLS path so lists populate.

- [ ] **C3 Inventory report empty**
  - File: `erp-mobile-app/src/api/reports.ts`
  - Action: validate source query/date filters and ensure movement flow shows records.

- [ ] **C4 Studio/Rental report empty in range**
  - File: `erp-mobile-app/src/api/reports.ts`
  - Action: normalize date filtering and mapping for current schema.

- [ ] **C5 UUID to reference number in cards**
  - File: `erp-mobile-app/src/components/accounts/reports/_shared/ReportCard.tsx`
  - Action: show human reference/document number, not UUID.

- [ ] **C6 In/Out pattern and floating balance**
  - Files: ledger/day-book timeline/report UI components.
  - Action: clear in/out visual differentiation and running balance visibility.

## Phase D - Light Redesign Alignment

- [ ] **D1 Sales page light redesign**
  - File: `erp-mobile-app/src/components/sales/SalesHome.tsx`
  - Action: align with improved module pattern while preserving behavior.

- [ ] **D2 Accounts module light redesign**
  - Files: accounts home/module components.
  - Action: align card hierarchy and transaction drill-down flow with reports style.

## Phase E - Web Access Audit Cleanup

- [ ] **E1 Access matrix cleanup**
  - Files: access settings UI + role permission data path.
  - Action: remove duplicate/extra rules and align effective permission mapping.

## Phase F - Deploy + Verification

- [ ] **F1 Deploy and smoke-test**
  - Build web/mobile as required.
  - Apply migrations on VPS.
  - Run sequence/data refresh scripts.
  - Smoke test:
    - payment receive no duplicate error,
    - rental payment no `total` error,
    - partial sale return works,
    - sales/purchase 3-dot actions stay in-app,
    - reports show data,
    - worker postings stay on sub-account.

## Carry-Over Order (if time ends)

If same-day time is short, postpone in this order:

1. Phase E (access audit)
2. Phase D2 (accounts redesign)
3. Phase D1 (sales redesign)
4. Phase B edit flows polish (keep minimal functional fallback)
