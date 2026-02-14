# ERP UI Responsive Checklist

Mobile verification for ERP UI (no native app yet). Test in browser DevTools mobile view or on a real device.

## Viewport

- [x] **Viewport meta tag** – `index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`

## Tables

- [x] **Horizontal scroll** – Tables use `overflow-x-auto` on wrapper (or `overflow-x-auto overflow-y-auto`)
- [x] **Min-width** – Wide tables use `min-w-[...]` so they scroll instead of squashing
- **Files updated:** `PurchasesPage`, `RentalOrdersList`, `ResponsiveTestPage`

### Pattern

```tsx
<div className="overflow-x-auto rounded-lg border border-gray-800">
  <table className="w-full text-sm min-w-[600px]">
    ...
  </table>
</div>
```

## Drawers / Sheets

- [x] **Full width on mobile** – `w-full max-w-full sm:max-w-md`
- [x] **Buttons visible** – Footer uses `shrink-0` or `flex flex-col` with sticky footer
- **Files updated:** `sheet.tsx` (base), `AddExpenseDrawer`, `ExpensesDashboard`, `ResponsiveTestPage`

### Pattern

```tsx
<SheetContent side="right" className="w-full max-w-full sm:max-w-md ... flex flex-col">
  <div className="flex-1 overflow-y-auto">...</div>
  <div className="shrink-0 p-4 border-t flex gap-2">
    <Button>Cancel</Button>
    <Button>Save</Button>
  </div>
</SheetContent>
```

## Forms

- [x] **Inputs full width** – `w-full` on inputs
- [x] **Buttons** – `w-full sm:w-auto` for primary actions on mobile

## Test Page

- [x] **`/test/responsive`** – Test Pages > Responsive Test
- Includes: table, form, sheet, dialog
- Use for quick mobile verification

## Quick Verification

1. Open **Test Pages > Responsive Test**
2. Resize to 375px width (iPhone SE) or use DevTools device toolbar
3. Check: table scrolls horizontally, sheet is full width, buttons visible
4. Spot-check: Purchases, Rentals, Expenses dashboards
