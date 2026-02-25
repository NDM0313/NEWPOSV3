# Date Format Audit – Global Standard DD MMM YYYY

## Standard

- **Display format:** `DD MMM YYYY` (e.g. 25 Feb 2026, 02 Mar 2026)
- **Storage/API:** `YYYY-MM-DD` (ISO)
- **Component:** Use shared `DatePicker` from `@/app/components/ui/DatePicker` for all date inputs.

## Usage audit (pre-migration)

### `type="date"` inputs (replace with DatePicker)

| File | Notes |
|------|--------|
| `SettingsPageComplete.tsx` | 3x type="date" |
| `SettingsPageNew.tsx` | 3x type="date" |
| `StudioProductionAddPage.tsx` | 3x type="date" |
| `StudioProductionDetailPage.tsx` | production_date |
| `StudioSaleDetailNew.tsx` | Expected Completion in Assign modal ✅ migrated to DatePicker |
| `AccountingTestPage.tsx` | 6x type="date" (test page) |
| `CustomerLedgerComponents/DateRangeFilter.tsx` | 2x type="date" |
| `ModernDateFilter.tsx` (both variants) | 2x each type="date" |
| `CreateBusinessWizard.tsx`, `CreateBusinessForm.tsx` | 1x each |
| `AddBranchModal.tsx` | 2x type="date" |
| `PickupModal.tsx`, `ReturnModal.tsx`, `RentalOrdersList.tsx` | rentals |
| `ExpensesDashboard.tsx` | 2x type="date" |
| `TopHeader.tsx` | 2x type="date" |
| `DateRangePicker.tsx` | 2x type="date" (range) |
| `InventoryDashboardNew.tsx` | 2x type="date" |
| `CustomerLedgerTestPage.tsx`, `CustomerLedgerInteractiveTest.tsx` | 2x each |
| `LedgerDebugTestPage.tsx` | 2x type="date" |

### date-fns `format(..., '...')` and display

- Prefer `DISPLAY_DATE_FORMAT` or `'dd MMM yyyy'` for user-facing dates.
- `src/utils/dateFormat.ts`: `formatDate`, `formatDateRange` already use DD MMM YYYY.
- Many Studio/Sales components already use `safeFormatDate(..., 'dd MMM yyyy')` or equivalent.

### Shared component

- **DatePicker** (`src/app/components/ui/DatePicker.tsx`): value = YYYY-MM-DD string, display = DD MMM YYYY, uses CalendarDatePicker (no native picker).
- **CalendarDatePicker**: supports optional `displayFormat` for DD MMM YYYY.

## Migration order (recommended)

1. Studio (StudioSaleDetailNew ✅, StudioProductionAddPage, StudioProductionDetailPage)
2. Sales / Purchases (forms with order/sale date)
3. Accounting (date filters, ledger)
4. Expense (ExpensesDashboard, AddExpenseDrawer)
5. Settings, Branches, Rentals, Inventory
6. Test/debug pages last

## Do not break backend

- Continue sending/receiving dates as ISO (YYYY-MM-DD) or existing API format.
- Only change how dates are **displayed** and **input** in the UI.
