# Reports Module Documentation

## Overview
Comprehensive reporting suite for analyzing business performance, inventory lifecycle, and profitability.

## Components
- `src/app/components/reports/ReportsDashboard.tsx`: Main entry point for reports.
- `src/app/components/reports/ProfitLossStatement.tsx`: Financial P&L tracking.
- `src/app/components/reports/ProductLedger.tsx`: Detailed history of product movements.
- `src/app/components/reports/ItemLifecycleReport.tsx`: Tracking specific items from procurement to sale/rental.
- `src/app/components/reports/CustomerProfitability.tsx`: Analysis of customer value.
- `src/app/components/reports/ReportActions.tsx`: Action buttons (Print, Export, etc.).

## Recent Changes
- Standardized to dark mode.

## Tech Stack
- React
- Tailwind CSS
- Recharts (likely for visualizations)

## Cursor AI Instructions
When working on this module:
1. Data accuracy is paramount.
2. Ensure tables can handle large datasets (pagination/virtualization).
3. Export functionality (PDF/Excel) should be robust.
4. Visualizations should be clear against the dark background.
