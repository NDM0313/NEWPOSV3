# Contacts (CRM) Module Documentation

## 1. Module Name & Overview
**Module**: Contact Management (CRM)
**Purpose**: Central database for both Suppliers and Customers. Tracks contact details, ledger balances (Receivables/Payables), and transaction history.

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Action Bar**: Flex container with "Add Contact" button.
- **Search**: Large input with absolute positioned Search icon.

### Components

#### Stats Row
- **Receivables Card**: Highlight `text-yellow-300` (Money coming in).
- **Payables Card**: Highlight `text-white` (Money going out).
- **Trend Indicators**: `ArrowUpRight` (Green) / `ArrowDownRight` (Red).

#### Contact Table
- **Type Badge**:
  - Supplier: Purple Theme.
  - Customer: Blue Theme.
- **Financial Columns**:
  - Receivables: Yellow text.
  - Payables: Red text.
  - Zero values: Grey dash.

#### Modals/Drawers
- **Quick Add**: Modal for rapid data entry.
- **Ledger**: Side drawer showing transaction history.
- **Delete**: Confirmation modal.

## 3. Data & Schema

### Contact Entity (`contacts`)
- `id` (UUID)
- `name` (Text)
- `type` (Enum: 'Supplier', 'Customer', 'Employee')
- `email` (Text, Optional)
- `phone` (Text)
- `address` (Text)
- `balance` (Decimal) - Positive = Receivable, Negative = Payable.
- `status` (Enum: 'Active', 'On Hold')

### Ledger (`transactions`)
- `id` (UUID)
- `contact_id` (FK)
- `amount` (Decimal)
- `type` (Enum: 'Credit', 'Debit')
- `description` (Text)
- `date` (Timestamp)

## 4. Interaction & Business Logic

### Ledger Logic
- **Receivable**: Money customer owes us.
- **Payable**: Money we owe supplier.
- **Net Balance**: The system calculates `sum(debits) - sum(credits)`.

### Adding a Contact
1. **Form**: Name, Type, Phone are required.
2. **Initial Balance**: Option to set opening balance (e.g., migrating old data).

### Deletion
- **Soft Delete**: Mark as archived if transactions exist.
- **Hard Delete**: Allowed only if no transaction history exists.

## 5. Edge Cases & Validations

- **Duplicate Phone**: Prevent multiple contacts with same phone number.
- **Negative Receivables**: Should ideally be converted to "Advance Payment" (Liability).
- **Validation**: Name length > 2 chars.

## 6. API/Supabase Requirements

- **Tables**: `contacts`, `transactions`.
- **Views**: `contact_balances` (Aggregate view for performance).
