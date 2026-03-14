# ERP Sales Latest Ordering Fix

## Problem

- Newly created sales did not appear at the top of the list.
- Lists/reports did not show the newest saved rows first.

## Root cause

- **saleService.getAllSales** already orders by `created_at` descending (newest first).
- **SalesPage** then re-sorts the loaded sales by a **default sort key** which was **`date`** (invoice/sale date) with `sortDir: 'desc'`.
- So the list was ordered by **invoice date** descending, not by **created date**. New sales created today could have the same invoice date as older ones, so “latest created” was not guaranteed to be at the top.

## Fix

**File:** `src/app/components/sales/SalesPage.tsx`

- **Default sort key** changed from `'date'` to **`'createdAt'`**, with `sortDir` remaining `'desc'`.
- **Sort key type** extended to include `'createdAt'`.
- **getSaleSortValue** for `'createdAt'`: use `(s as any).createdAt || s.date || 0` and return its timestamp so newest-created sales sort first when direction is desc.

The API still returns rows in `created_at` desc order; the client-side sort now consistently uses **createdAt** by default, so newly created sales (with the latest `created_at`) appear at the top of the list.

## Verification

- **Case E:** Create a new sale → it appears at the top of the Sales list (with default sort).
- **Case F:** Newly created sales appear in the correct place in commission/sales-related lists that use the same or similar data; commission report uses its own query and ordering (invoice_date, etc.), so no change there unless those reports are updated separately.

## Rollback

- In SalesPage, set default `sortKey` back to `'date'` and remove `'createdAt'` from the sort key type and from `getSaleSortValue`.
