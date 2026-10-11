# Figma Mobile ERP Design – Integration Guide

This document describes how the **Figma Mobile ERP App Design** folder has been integrated into the **erp-mobile-app** and what remains to be done.

## ✅ Completed Integrations

### 1. Shared & Common Components
- **`components/shared/DateTimePicker.tsx`** – iOS-style date/time wheel picker
- **`components/shared/DateInputField`** – Date input with picker trigger
- **`components/common/LongPressCard.tsx`** – Card with long-press action menu (View, Edit, Delete, Duplicate)

### 2. Reports Module (Documentation Design)
- **`components/reports/DateRangeSelector.tsx`** – Date presets (Today, Week, Month, Year, Custom)
- **`components/reports/ReportActions.tsx`** – Export PDF, Print, Share actions
- **`components/reports/SalesReports.tsx`** – Sales report with mock data, PDF export, detail view
- **`utils/pdfGenerator.ts`** – PDF generation (jsPDF), download, print, share
- **`ReportsModule.tsx`** – Category grid (Sales, Purchase, Rental, Studio, etc.) + Sales Reports flow

### 3. Payment Dialog
- **`components/sales/PaymentDialog.tsx`** – Full Figma design (3-step: Method → Account → Amount, Full/Partial/Skip)

## 📁 Figma Design vs erp-mobile-app Mapping

| Figma Design | erp-mobile-app | Status |
|--------------|----------------|--------|
| shared/DateTimePicker | components/shared/DateTimePicker | ✅ Added |
| common/LongPressCard | components/common/LongPressCard | ✅ Added |
| reports/DateRangeSelector | components/reports/DateRangeSelector | ✅ Added |
| reports/ReportActions | components/reports/ReportActions | ✅ Added |
| reports/SalesReports | components/reports/SalesReports | ✅ Added |
| sales/PaymentDialog | components/sales/PaymentDialog | ✅ Updated |
| utils/pdfGenerator | utils/pdfGenerator | ✅ Added |

## 🔧 Dependencies

```bash
npm install jspdf   # For PDF export in reports
```

## 📋 Remaining Figma Components (To Integrate)

These exist in **Figma Mobile ERP App Design** and can be copied/adapted when needed:

### Purchase Module
- `CreatePurchaseFlow.tsx` – 5-step purchase workflow
- `SelectSupplierTablet.tsx`

### Rental Module
- `RentalBookingFlow.tsx`, `RentalDeliveryFlow.tsx`, `RentalReturnFlow.tsx`, `RentalDashboard.tsx`
- `SelectRentalCustomerTablet.tsx`

### Studio Module
- `StudioDashboard.tsx`, `StudioOrderDetail.tsx`, `StudioStageAssignment.tsx`

### Accounts Module
- `AccountsDashboard.tsx`, `GeneralEntryFlow.tsx`, `AccountTransferFlow.tsx`
- `SupplierPaymentFlow.tsx`, `WorkerPaymentFlow.tsx`, `ExpenseEntryFlow.tsx`
- `SelectAccountTablet.tsx`

### Contacts Module
- `AddContactFlow.tsx`, `EditContactFlow.tsx`, `ContactDetailView.tsx`
- `SelectContactTablet.tsx`

### Reports (Additional)
- `PurchaseReports.tsx`, `RentalReports.tsx`, `StudioReports.tsx`
- `WorkerReports.tsx`, `AccountReports.tsx`, `ExpenseReports.tsx`, `InventoryReports.tsx`

### Products
- `ProductWithVariations.tsx`, `VariationSelector.tsx`, `AddProductFlow.tsx`

### UI Library (ShadcN)
- `components/ui/` – button, dialog, input, card, select, tabs, etc.

## 🎨 Design Tokens (from Documentation)

```css
--color-bg-dark: #111827;
--color-bg-card: #1F2937;
--color-border: #374151;
--color-text-muted: #9CA3AF;
--color-primary: #3B82F6;
--color-primary-hover: #2563EB;
--color-text-light: #F9FAFB;
```

## 📱 API Integration Notes

- **Reports**: `SalesReports` uses mock data. Wire to `reportsApi` or `salesApi` when ready.
- **PaymentDialog**: Already integrated with `SalesModule` and `handlePaymentComplete`.
- **DateTimePicker**: Use in forms that need date selection (rental dates, report ranges, etc.).
- **LongPressCard**: Use in list views (sales, purchases, contacts) for View/Edit/Delete actions.

## 🚀 Next Steps

1. Run `npm install` to ensure jspdf is installed.
2. Copy additional report types (Purchase, Rental, etc.) from Figma when needed.
3. Integrate `CreatePurchaseFlow`, rental flows, and accounts flows as modules expand.
4. Add `ProductWithVariations` and `VariationSelector` to Products and Sales flows.
