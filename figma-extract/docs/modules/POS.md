# POS (Point of Sale) Module Documentation

## 1. Module Name & Overview
**Module**: Point of Sale (POS) Terminal
**Purpose**: The primary interface for processing daily retail sales. It features a responsive, touch-friendly grid for selecting products, managing a shopping cart, applying discounts/wholesale pricing, and processing payments (Cash/Card).

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Background**: Strict Dark Mode (`bg-[#111827]`).
- **Layout**: Split Screen
  - **Left (Products)**: `flex-1` with flexible grid.
  - **Right (Cart)**: Fixed width `w-[460px]`, `bg-gray-900`, `border-l border-gray-800`.

### Components

#### Header Section
- **Back Button**: Ghost variant, `rounded-xl`, `hover:bg-gray-800`.
- **Search Input**:
  - Container: `relative`, `max-w-md`.
  - Field: `bg-gray-800/50 border-gray-700 rounded-xl pl-11 h-11`.
  - Focus State: `focus:border-blue-500 focus:ring-1`.
- **Stats Badge**: `bg-gray-800/50 border border-gray-700 rounded-xl`.

#### Category Pills
- **Container**: Horizontal scroll (`overflow-x-auto scrollbar-hide`).
- **Active State**: `bg-blue-600 text-white border-blue-500 shadow-lg`.
- **Inactive State**: `bg-gray-800/50 text-gray-400 border-gray-700`.

#### Product Grid
- **Card**: `aspect-square rounded-2xl border-2 border-gray-700/50 bg-gradient-to-br`.
- **Interactions**:
  - Hover: `scale-1.02`, `shadow-xl`, `border-blue-500/50`.
  - Tap: `scale-0.98`.
- **Badges**:
  - Stock: Top-right, `bg-black/40 backdrop-blur`.
  - Wholesale Tag: `bg-green-500/20 text-green-400`.

#### Cart Section
- **Cart Item**: `bg-gray-800/50 rounded-xl border border-gray-700`.
- **Quantity Controls**:
  - Minus: `bg-gray-900 border-gray-700`.
  - Plus: `bg-blue-600 border-blue-500`.
- **Toggle Switch (Pricing Mode)**:
  - Retail: Default.
  - Wholesale: `data-[state=checked]:bg-green-600`.
- **Checkout Buttons**:
  - Cash: Green Gradient (`from-green-600 to-green-700`).
  - Card: Blue Gradient (`from-blue-600 to-blue-700`).
  - Size: Large, touch-friendly (`py-4 rounded-xl`).

## 3. Data & Schema

### Frontend State
- **Cart Item Interface**:
  ```typescript
  interface CartItem {
    id: number;
    name: string;
    retailPrice: number;
    wholesalePrice: number;
    qty: number;
  }
  ```

### Database Schema (Supabase)

#### `products` (Read Only here)
- `id` (int/uuid)
- `name` (text)
- `retail_price` (decimal)
- `wholesale_price` (decimal)
- `stock_quantity` (int)
- `category` (text)
- `sku` (text)

#### `sales` (Write)
- `id` (uuid)
- `created_at` (timestamp)
- `customer_name` (text, nullable)
- `total_amount` (decimal)
- `subtotal` (decimal)
- `tax_amount` (decimal)
- `discount_percentage` (int)
- `payment_method` (enum: 'Cash', 'Card')
- `is_wholesale` (boolean)

#### `sale_items` (Write)
- `sale_id` (fk -> sales.id)
- `product_id` (fk -> products.id)
- `quantity` (int)
- `unit_price` (decimal) - *Store the price at time of sale*

## 4. Interaction & Business Logic

### Adding to Cart
1. **User Action**: Click product card.
2. **Logic**:
   - Check if item exists in `cart` state.
   - If yes: Increment `qty` by 1.
   - If no: Push new object with `qty: 1`.

### Pricing Mode Toggle
1. **User Action**: Toggle "Pricing Mode" switch.
2. **Logic**: Updates `isWholesale` boolean.
3. **Effect**:
   - Product Grid displays `wholesalePrice`.
   - Cart totals recalculate immediately using `wholesalePrice`.

### Payment Processing
1. **User Action**: Click "Cash Payment" or "Card Payment".
2. **Logic**:
   - Validate cart is not empty.
   - Calculate final totals (Subtotal - Discount + Tax).
   - **API Call**: Create `sales` record -> Create `sale_items` records -> Update `products.stock_quantity`.
3. **Success**:
   - Show Success Toast/Modal.
   - Clear Cart.
   - Optionally print receipt.

## 5. Edge Cases & Validations

- **Out of Stock**:
  - Product card should be visually dimmed or disabled if `stock <= 0`.
  - Prevent adding to cart if requested qty > available stock.
- **Empty Cart**:
  - Checkout buttons are `disabled` (Opacity 50%, grayscale).
  - Clear Cart button is disabled.
- **Discount Limits**:
  - Discount input restricted to 0-100.
- **Negative Quantity**:
  - Decrementing logic ensures quantity stops at 0 or removes item (currently removes at 0).

## 6. API/Supabase Requirements

- **Real-time Stock Updates**: Subscription to `products` table changes so POS reflects stock changes made from other terminals.
- **Transaction Atomicity**: Sales recording and stock deduction must happen in a stored procedure or single transaction block to prevent data inconsistencies.
