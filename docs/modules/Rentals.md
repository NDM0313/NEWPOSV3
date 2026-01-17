# Rental Management Module Documentation

## 1. Module Name & Overview
**Module**: Rental Management System
**Purpose**: Manages the booking of bridal dresses and accessories for specific dates. Tracks pickup dates, return dates, security deposits, and overdue items.

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **View Toggle**: Segmented control style.
  - Active: `bg-gray-800 text-white shadow-sm`.
  - Inactive: `text-gray-400`.
- **Primary Button**: Pink Theme (`bg-pink-600 hover:bg-pink-500 shadow-pink-600/20`).

### Components

#### Dashboard Header
- **Title**: `text-2xl font-bold tracking-tight`.
- **View Switcher**: Icons for `LayoutList` vs `Calendar`.

#### Quick Stats (List View Only)
- **Grid**: 4 Columns (`md:grid-cols-4`).
- **Cards**: `bg-gray-900 border border-gray-800 rounded-xl`.
- **Typography**:
  - Label: `text-gray-500 text-sm`.
  - Value: `text-2xl font-bold` (Colors: White, Orange, Red, Green).

#### Calendar View
- **Component**: `RentalCalendar.tsx`.
- **Function**: Visualizes booking overlap to prevent double-booking unique dresses.

#### List View
- **Component**: `RentalOrdersList.tsx`.
- **Function**: Tabular view of all active/past rentals.

## 3. Data & Schema

### Rental Order (`rental_orders`)
- `id` (UUID)
- `customer_id` (FK)
- `booking_date` (Timestamp)
- `pickup_date` (Date)
- `return_date` (Date)
- `total_amount` (Decimal)
- `security_deposit` (Decimal)
- `status` (Enum: 'Booked', 'Picked Up', 'Returned', 'Overdue', 'Cancelled')

### Rental Items (`rental_items`)
- `rental_id` (FK)
- `product_id` (FK) - *Must be a rental-type product*
- `condition_on_out` (Text)
- `condition_on_return` (Text)

## 4. Interaction & Business Logic

### Creating a Booking
1. **User Action**: Click "New Rental Booking" (Pink Button).
2. **Drawer**: Opens `RentalBookingDrawer`.
3. **Validation**: Checks availability of the specific item for the selected date range.
   - *Logic*: `WHERE product_id = X AND (start_date <= requested_end AND end_date >= requested_start)` must return 0 rows.

### Return Process
1. **Action**: Click "Return" on an active rental.
2. **Modal**: Opens `ReturnDressModal`.
3. **Logic**:
   - Assess condition (Damaged/Good).
   - Calculate Late Fees (if `today > return_date`).
   - Refund Security Deposit logic (Total - Damages - Late Fee).

## 5. Edge Cases & Validations

- **Double Booking**: The system must strictly prevent booking the same unique dress (SKU) for overlapping dates.
- **Overdue Handling**:
  - Automatically flag rentals where `return_date < today` and `status != Returned`.
  - Stats card "Overdue Items" increments.
- **Security Deposit**:
  - Must be tracked separately from Revenue (Liability).

## 6. API/Supabase Requirements

- **Tables**: `rental_orders`, `rental_items`.
- **Policies**:
  - Rentals require `security_deposit` field handling which might need restricted access (Manager only for refunds).
