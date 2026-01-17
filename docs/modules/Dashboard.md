# Dashboard Module Documentation

## 1. Module Name & Overview
**Module**: Main Dashboard (Executive Overview)
**Purpose**: Serves as the landing page for the ERP, providing immediate visibility into critical business metrics (Sales, Profit, Payables/Receivables), inventory health (Low Stock Alerts), and quick navigation to production status.

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Background**: Global Default (`bg-gray-50 dark:bg-gray-900` handled by theme, but strictly dark in this context).
- **Grid Layout**: Responsive Grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).

### Components

#### Low Stock Banner
- **Container**: `bg-red-500/10 border border-red-500/20 rounded-xl`.
- **Icon**: `AlertTriangle` in `bg-red-500/20 text-red-500` box.
- **Action**: Text button `text-red-500 hover:text-red-400`.

#### Stat Cards
- **Container**: `bg-gray-900 border border-gray-800 rounded-xl relative overflow-hidden`.
- **Hover Effect**: `hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-xl`.
- **Background Graphic**: `bg-blue-500/5 rounded-bl-full` (Decorative absolute shape).
- **Typography**:
  - Title: `text-gray-400 text-sm`.
  - Value: `text-2xl font-bold text-white`.
  - Trend: `bg-green-500/10 text-green-500` (Up) or `bg-red-500/10 text-red-500` (Down).

#### Custom Studio Widget
- **Size**: Spans 2 columns on mobile/tablet (`md:col-span-2`), 1 on large screens.
- **Visuals**:
  - Production dots: `w-2 h-2 rounded-full bg-purple-500` (Dyeing), `bg-green-500` (Ready).

#### Charts Section
- **Container**: `bg-white dark:bg-gray-900 border border-gray-800 rounded-xl`.
- **Chart Library**: Recharts (`AreaChart`).
- **Gradients**: SVG defs for `colorSales` (Blue) and `colorProfit` (Green).

## 3. Data & Schema

### Data Points (Aggregated)

#### `sales_metrics` (View/Calculated)
- `total_sales_today` (decimal)
- `net_profit_month` (decimal)
- `receivables_total` (decimal) - Sum of unpaid invoices.
- `payables_total` (decimal) - Sum of unpaid POs.

#### `inventory_alerts`
- List of items where `stock_quantity <= min_stock_level`.
- Fields: `id`, `name`, `sku`, `stock`, `min_level`.

### Chart Data Structure
```typescript
{
  name: string; // Day/Date
  sales: number;
  profit: number;
}
```

## 4. Interaction & Business Logic

### Navigation
- **Custom Studio Widget**: Click -> Navigates to `custom-pipeline` view.
- **Low Stock Banner**: Click -> Navigates to `products` filtered by "Low Stock".

### Data Visualization
- **Tooltip**: Hovering over the chart shows exact Sales and Profit figures for that day.
- **Real-time**: Ideally, this page fetches data on mount. For a bridal ERP, "Live" websockets might be overkill, so SWR/React-Query caching is recommended.

## 5. Edge Cases & Validations

- **Zero Data**:
  - If no sales exist, charts should show empty state or flat lines rather than crashing.
  - Stat cards should show "$0.00".
- **Loading State**:
  - Skeleton loaders (shimmer effect) should be used for the 4 stat cards and the main chart while fetching.

## 6. API/Supabase Requirements

- **Dashboard API**: A dedicated RPC (Remote Procedure Call) in Supabase is recommended to fetch all dashboard stats in one request to avoid waterfall fetching.
  - `get_dashboard_stats()`: Returns JSON with stats, chart data, and alerts.
- **Permissions**: Restricted to 'Admin' and 'Manager' roles. Staff might see a limited version.
