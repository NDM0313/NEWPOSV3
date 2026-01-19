# Purchases Module Documentation

## 1. Module Name & Overview
**Module**: Purchase Management
**Purpose**: Manages procurement of inventory from suppliers. Tracks Purchase Orders (POs), supplier dues, and inventory restocking.

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Theme**: Orange accent (`bg-orange-600`, `text-orange-400`).
- **Icons**: `ShoppingBag` (Orange), `DollarSign` (Red), `RotateCcw` (Yellow - Returns).

### Components

#### Stats Section
- **Total Purchase**: Orange highlight.
- **Amount Due**: Red highlight (Critical liability).
- **Returns**: Yellow highlight.

#### Table Columns
- **Ref No**: `PO-XXX`.
- **Paid**: Green text.
- **Due**: Red text (if > 0).

## 3. Data & Schema

### Purchase Order (`purchases`)
- `id` (UUID)
- `ref_no` (Text)
- `supplier_id` (FK)
- `purchase_date` (Timestamp)
- `total_amount` (Decimal)
- `paid_amount` (Decimal)
- `status` (Enum: 'Received', 'Pending', 'Ordered')

### Purchase Items (`purchase_items`)
- `purchase_id` (FK)
- `product_id` (FK)
- `quantity` (Int)
- `unit_cost` (Decimal)

## 4. Interaction & Business Logic

### Receiving Stock
1. **Action**: Create Purchase.
2. **Logic**:
   - Increases `products.stock_quantity`.
   - Updates `products.cost_price` (Moving Average or FIFO).
   - Creates Payable ledger entry for Supplier.

### Returns
- **Logic**:
  - Decreases Stock.
  - Decreases Payable amount (Debit Note).

## 5. Edge Cases & Validations

- **Supplier Validation**: Must select valid supplier.
- **Zero Cost**: Warning if unit cost is 0.
- **Credit Limit**: (Optional) Prevent PO if supplier due exceeds limit.

## 6. API/Supabase Requirements

- **Tables**: `purchases`, `purchase_items`.
- **Triggers**: Update stock on insert/update of `purchase_items`.
