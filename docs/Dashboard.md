# Dashboard Module Documentation

## Overview
The Dashboard is the central hub of the Din Collection ERP. It provides analytics, stock overviews, and expense tracking.

## Components
- `src/app/components/dashboard/Dashboard.tsx`: Main dashboard view.
- `src/app/components/dashboard/ExpensesDashboard.tsx`: Expense analytics.
- `src/app/components/dashboard/StockDashboard.tsx`: Stock levels and alerts.
- `src/app/components/dashboard/AddCategoryModal.tsx`: Modal to add new categories.
- `src/app/components/dashboard/AddExpenseDrawer.tsx`: Drawer for adding expenses.

## Recent Changes
- Resolved dimension errors in dashboard charts.
- Ensured strict dark mode (`#111827`) compatibility.

## Tech Stack
- React
- Tailwind CSS
- Recharts (for analytics)

## Cursor AI Instructions
When working on this module:
1. Maintain the strict dark mode background (`#111827`).
2. Ensure charts are responsive and do not overflow containers.
3. Keep the layout grid-based and responsive for different screen sizes.
