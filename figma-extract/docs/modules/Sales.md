# Sales Module Documentation

## 1. Module Name & Overview
**Module**: Sales Management
**Purpose**: Tracks all finalized sales invoices, monitors daily/monthly revenue, and manages payment statuses (Paid/Partial/Pending).

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Cards**: `GlassCard` with `ShoppingBag` (Blue), `Calendar` (Green), `TrendingUp` (Yellow).
- **Table**: Standardized.

### Components

#### Status Badges
- **Paid**: `bg-green-500/10 text-green-500`.
- **Partial**: `bg-yellow-500/10 text-yellow-500`.
- **Pending/Unpaid**: `bg-red-500/10 text-red-500`.

#### Financial Columns
- **Expenses**: Orange text (deductions from gross sale).
- **Total**: White bold text.

## 3. Data & Schema

### Sales Invoice (`sales`)
- `id` (UUID)
- `invoice_no` (Text, Auto-generated e.g., INV-001)
- `customer_id` (FK)
- `sale_date` (Timestamp)
- `subtotal` (Decimal)
- `discount_amount` (Decimal)
- `tax_amount` (Decimal)
- `expense_amount` (Decimal) - e.g., Shipping cost.
- `total_amount` (Decimal)
- `paid_amount` (Decimal)
- `status` (Enum: 'Paid', 'Partial', 'Pending')

## 4. Interaction & Business Logic

### Invoice Generation
- **Source**: Usually created via POS or "Add Sale" manual entry.
- **Numbering**: Sequential (INV-0001, INV-0002).

### Payment Status
- Automatically calculated:
  - If `paid >= total` -> Paid.
  - If `paid > 0 AND paid < total` -> Partial.
  - If `paid == 0` -> Pending.

### Expenses
- Specific expenses attached to a sale (e.g., Delivery Fee paid to 3rd party) reduce the *Net Profit* but might be added to the *Invoice Total* depending on business logic. In this UI, it seems to be an addition to the cost or a deduction. (clarification: In code, Total = Subtotal + Expenses usually implies shipping charged to customer).

## 5. Edge Cases & Validations

- **Overpayment**: UI should warn if `paid > total` (Change due).
- **Edit Invoice**: Restricted after 24 hours (security policy).
- **Void Invoice**: Reverses stock deduction.

## 6. API/Supabase Requirements

- **Tables**: `sales`, `sale_items`, `payments`.
- **Functions**: `get_sales_metrics()` for the stats cards.
