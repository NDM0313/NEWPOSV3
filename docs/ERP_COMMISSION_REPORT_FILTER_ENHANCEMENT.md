# Commission Report Salesman Filter Enhancement

**Date:** 2026-03-14  
**Scope:** Local only. Reports → Commission supports filtering by salesman.

---

## Requirement

Admin should be able to:
- View all salesmen (default).
- Filter by one salesman and see that salesman’s commission data for the selected date range.

---

## Implementation

1. **State**
   - `salesmanFilterId: string | null` – `null` = all salesmen; otherwise the selected `salesman_id`.

2. **Filter bar**
   - Added a bar above the summary cards with:
     - Label: "Salesperson"
     - `<Select>` with value `salesmanFilterId ?? 'all'`, options:
       - `"all"` → All salesmen
       - One option per `data.summary` row: `row.salesman_id` / `row.salesman_name`
     - Period text (start–end date) for context.

3. **Filtered data**
   - `filteredSummary = useMemo`: if `salesmanFilterId` is null, use `data.summary`; else `data.summary.filter(row => row.salesman_id === salesmanFilterId)`.
   - Summary cards and the "Commission by sale" table use `filteredSummary` instead of `data.summary`.
   - Table caption shows "Filtered by salesperson" when a salesman is selected.

4. **Backend**
   - No change. `getCommissionReport(companyId, startDate, endDate)` still returns all commission data for the period; filtering is client-side.

---

## Files changed

- `src/app/components/reports/CommissionReportPage.tsx` – state, Select, `filteredSummary`, and use of it in cards and table.

---

## Rollback

Remove `salesmanFilterId` state, the Select filter bar, and `filteredSummary`; use `data.summary` again everywhere.
