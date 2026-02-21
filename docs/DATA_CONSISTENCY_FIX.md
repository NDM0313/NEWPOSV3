# Web–Mobile Data Consistency Fix

**Date:** February 2026

## Problem

Web (PWA) aur mobile (Capacitor) dono same admin user se login the, lekin alag data dikh raha tha.

## Root Causes

1. **SalesHome (mobile)** – Hardcoded mock data (`recentSales` array) use ho raha tha.
2. **HomeScreen (mobile)** – "Today's Sales" aur "Pending" hardcoded values (Rs. 45,000, Rs. 12,000).
3. **Branch filter** – Mobile modules ko `selectedBranch` pass nahi ho raha tha.

## Fixes Applied

### 1. Mobile API: `getAllSales` (erp-mobile-app/src/api/sales.ts)

- Web `saleService.getAllSales` ke mutabiq function add kiya.
- Same filters: `company_id`, optional `branch_id`.
- Same select: `sales` + `contacts` + `branches` + `sales_items`.
- Same order: `created_at` desc, `invoice_date` desc.

### 2. Mobile API: `getReceivables` (erp-mobile-app/src/api/reports.ts)

- Total receivables (due from customers) ke liye API add kiya.
- Web Dashboard "Total Due (Receivables)" ke mutabiq.

### 3. SalesHome (erp-mobile-app/src/components/sales/SalesHome.tsx)

- Mock data hata diya.
- `getAllSales` aur `getSalesSummary` se real data fetch.
- `companyId` aur `branchId` props se receive.

### 4. HomeScreen (erp-mobile-app/src/components/HomeScreen.tsx)

- `getSalesSummary` se Today's Sales.
- `getReceivables` se Pending amount.
- `companyId` prop add kiya.

### 5. Branch Passing

- `SalesModule` ko `branchId` prop add kiya.
- `App.tsx` se `selectedBranch?.id` pass kiya.

## Verification

### Supabase Config

- Web: `.env.local` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Mobile: `erp-mobile-app/.env` → `npm run sync:mobile-env` se sync

### Branch Filter

- Web: `SupabaseContext` → `branchId` (admin = "all", user = specific branch)
- Mobile: `selectedBranch` localStorage se, branch selection screen se set

### Testing Checklist

- [ ] Same login credentials se web aur mobile par login karo
- [ ] Same branch select karo mobile par
- [ ] SalesHome: Recent sales same hon web aur mobile par
- [ ] HomeScreen: Today's Sales aur Pending same hon
- [ ] Products: Company-level, dono par same
- [ ] Contacts: Company-level, dono par same

## Notes

- Mobile sales flow (create sale) abhi bhi persist nahi karta – PaymentDialog sirf UI hai. Future: `createSale` API integrate karna.
- Products aur Contacts company-scoped hain, branch filter nahi.
- `npm run sync:mobile-env` run karo mobile env update ke baad.
