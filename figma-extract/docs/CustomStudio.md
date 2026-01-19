# Custom Studio Module Documentation

## 1. Module Name & Overview
**Module**: Custom Studio (Manufacturing Pipeline & Vendor Management)
**Purpose**: Manages the end-to-end lifecycle of bespoke bridal orders, from initial order creation to the final ready status. It also handles the database of external vendors (dyers, tailors, embroiderers) who contribute to the production process.

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Background**: Strict Dark Mode (`#111827` / `bg-gray-900`).
- **Cards/Containers**: `bg-gray-900/50` or `bg-gray-950` with `border-gray-800`.
- **Primary Actions**: Blue (`bg-blue-600 hover:bg-blue-500`).
- **Typography**: Sans-serif, white text for headings, `text-gray-400` for secondary text.

### Sub-Modules

#### A. New Custom Order (`NewCustomOrder.tsx`)
- **Layout**: Full-screen flex column. Header top, scrollable body.
- **Components**:
  - `Card`: Container for logical grouping (Customer Details, Specifications).
  - `Badge` (Purple): Indicates Wholesale orders (`bg-purple-500/20`).
  - `Select` (Shadcn): For customer search.
  - `DatePicker` (Native Input with invert fix): `[&::-webkit-calendar-picker-indicator]:invert`.

#### B. Pipeline Board (`PipelineBoard.tsx`)
- **Layout**: Kanban Board style. Horizontal scrolling (`overflow-x-auto`).
- **Columns**:
  1. **Cutting**: Blue theme.
  2. **Dyeing**: Purple theme.
  3. **Stitching**: Orange theme.
  4. **Ready**: Green theme.
- **Task Cards**: `bg-gray-800`, hover effects, context menu for moving/editing.

#### C. Vendor List (`VendorList.tsx`)
- **Layout**: Data Table with Search/Filter toolbar.
- **Components**:
  - `Table`: Rows with hover effects (`hover:bg-gray-800/30`).
  - `Dialog`: For Adding/Editing vendors.
  - `Status Badge`: Green (Active) vs Orange (Busy).

## 3. Data & Schema

### Core Tables

#### `custom_orders`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. |
| `customer_id` | UUID | FK to `contacts`. |
| `order_type` | String | 'Retail' \| 'Wholesale'. |
| `item_name` | String | e.g., "Red Bridal Lehenga". |
| `design_sku` | String | Optional reference. |
| `measurements` | Text | JSON or String notes. |
| `status` | Enum | 'cutting', 'dyeing', 'stitching', 'ready'. |
| `due_date` | Date | Target completion. |

#### `vendors`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Int/UUID | Primary Key. |
| `name` | String | Vendor Name. |
| `type` | Enum | 'Dyer', 'Tailor', 'Embroiderer', 'Supplier'. |
| `phone` | String | Contact number. |
| `location` | String | City or Area. |
| `status` | Enum | 'Active', 'Busy'. |

## 4. Interaction & Business Logic

### Order Creation
1. **User Action**: Click "New Order" on Pipeline Board.
2. **Form Entry**: Select Customer.
   - *Logic*: If Customer Type is 'Wholesale', auto-show Purple Badge and "Bulk Pricing" alert.
3. **Submission**: Click "Create Order".
   - *Logic*: Validate fields -> POST to API -> Redirect to Board (New card appears in 'Cutting').

### Pipeline Management
1. **Move Stage**: User clicks "Move Next" in card dropdown.
   - *Logic*: Status updates sequentially: Cutting -> Dyeing -> Stitching -> Ready.
   - *Visual*: Card moves to the next column instantly (Optimistic UI).
2. **Delete**: Removes order from the board (Soft delete in DB).

### Vendor Management
1. **Add/Edit**: Opens Modal.
2. **Save**:
   - Checks validation (Name/Type required).
   - Updates local state and syncs with backend.
3. **View Details**: Opens read-only modal with vendor stats (Active Orders count).

## 5. Edge Cases & Validations

- **Empty States**:
  - Pipeline: "No orders in this stage".
  - Vendor List: "No vendors found".
- **Validation**:
  - Order Form: Create button disabled if processing.
  - Vendor Form: Name and Service Type are mandatory.
- **Dates**: Past due dates should ideally highlight red in the Pipeline card (Future enhancement).
- **Wholesale Handling**: Wholesale orders visually distinct (Purple tags) to ensure priority handling.

## 6. API/Supabase Requirements

### Policies (RLS)
- **View**: Authenticated staff can view all orders/vendors.
- **Edit**: Only 'Manager' role can delete vendors or move orders backwards (if implemented).

### Tables Needed
- `custom_orders`
- `vendors`
- `contacts` (for Customer lookup)
