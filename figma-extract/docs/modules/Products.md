# Product Management Module Documentation

## 1. Module Name & Overview
**Module**: Product Management & Inventory
**Purpose**: The central catalog for all retail items. Allows adding, editing, deleting products, managing stock levels, setting prices (Retail/Wholesale), and printing barcodes.

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Table Component**: Custom `SmartTable`.
- **Row Styling**: `hover:bg-gray-800/30 transition-colors`.
- **Text Colors**:
  - Primary: `text-white`.
  - Secondary/Meta: `text-gray-500`.

### Components

#### Data Columns (Table)
- **Product Name**: Composite cell (Image Placeholder + Name + SKU).
- **Stock**: Conditional coloring.
  - `< 10`: `text-red-400`.
  - `>= 10`: `text-green-400`.
- **Status Pills**:
  - Active: `bg-green-500/10 text-green-500`.
  - Low Stock: `bg-yellow-500/10 text-yellow-500`.
  - Out of Stock: `bg-red-500/10 text-red-500`.

#### Action Menu (Dropdown)
- **Trigger**: Ghost Button with `MoreVertical` icon.
- **Items**:
  - `Printer` (Print Barcode).
  - `Copy` (Duplicate Product).
  - `History` (View Stock Logs).
  - `Trash2` (Delete - Red text).

#### Mobile Card View
- **Logic**: Switches from Table to Card view on small screens (`renderMobileCard` prop).
- **Layout**: Stacked info with status badge on top-right.

## 3. Data & Schema

### Product Entity (`products`)
- `id` (UUID)
- `name` (String)
- `sku` (String, Unique)
- `category_id` (FK)
- `retail_price` (Decimal)
- `wholesale_price` (Decimal)
- `cost_price` (Decimal) - *For profit calculation*
- `stock_quantity` (Integer)
- `min_stock_level` (Integer)
- `barcode` (String, Unique)
- `status` (Enum: 'Active', 'Archived')

## 4. Interaction & Business Logic

### Adding a Product
1. **User Action**: Click "Add Product" (handled by `SmartTable` header).
2. **Component**: Opens `ProductDrawer` (Side sheet).
3. **Logic**: Form submission creates a new row in Supabase.

### Stock Management
- **Visual Feedback**: The table automatically flags low stock items based on the `stock < 10` (hardcoded in UI currently, should be dynamic based on `min_stock_level`).

### Context Actions
- **Print Barcode**: Opens a modal to generate a printable barcode label (Code 128 or QR) for the SKU.
- **Delete**: Requires confirmation. Sets status to 'Archived' (Soft Delete) rather than removing the row to preserve historical sales data.

## 5. Edge Cases & Validations

- **Duplicate SKU/Barcode**:
  - Backend must enforce uniqueness.
  - Frontend should show specific error: "SKU already exists".
- **Negative Stock**:
  - Should technically be allowed for "Pre-orders" but visually flagged distinctively.
- **Large Lists**:
  - `SmartTable` handles pagination (implied). 1000+ products need server-side pagination.

## 6. API/Supabase Requirements

- **Tables**: `products`, `categories`, `stock_history`.
- **Functions**:
  - `search_products(query)`: optimize search by name/sku.
