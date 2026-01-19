# Settings Module Documentation

## 1. Module Name & Overview
**Module**: System Configuration & Settings
**Purpose**: Central hub for toggling business modules (Features Flags) and configuring specific logic for complex modules like Rentals (Pricing models, Security policies).

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Card**: Large clickable cards with enable/disable switches.
- **Active State**: `bg-gray-900 border-gray-700 shadow-lg`.
- **Inactive State**: `bg-gray-900/50 opacity-80`.

### Components

#### Module Card
- **Icon**: Color-coded background (Pink for Rentals, Orange for Manufacturing).
- **Switch**: Toggles `isEnabled` state in global context.
- **Configure Button**: Only active when enabled. Ghost variant `text-blue-400`.

#### Configuration Modal (e.g., Rental Config)
- **Dialog**: Max width `sm:max-w-[600px]`.
- **Inputs**: Dark theme inputs `bg-gray-900 border-gray-700`.
- **Checkboxes**: Custom styled `data-[state=checked]:bg-pink-600`.

## 3. Data & Schema

### Module State (Context/Local Storage)
- **Structure**:
  ```typescript
  type ModuleState = {
    [key in ModuleId]: {
      isEnabled: boolean;
      config: any; // Dynamic config object
    }
  }
  ```

### Rental Configuration Schema
- `pricing_model`: Enum ('per_event', 'per_day', 'per_hour').
- `require_id`: Boolean.
- `require_deposit`: Boolean.
- `turnaround_buffer`: Integer (Days/Hours).

## 4. Interaction & Business Logic

### Feature Toggling
1. **Action**: User toggles switch.
2. **Logic**: Updates `ModuleContext`.
3. **Effect**: Immediately shows/hides the corresponding Sidebar Link and Dashboard Widgets.

### Module Configuration
1. **Action**: Click "Configure" on active module.
2. **Modal**: Opens specific settings form.
3. **Example (Rentals)**:
   - Changing "Pricing Model" to 'Per Day' will change how the POS calculates rental fees.
   - Setting "Buffer Time" to '2 Days' will automatically block the calendar for 2 days after a return date.

## 5. Edge Cases & Validations

- **Dependency**: Disabling a core module (like Accounting) might be restricted if other modules depend on it (not currently enforced but good practice).
- **Data Persistence**: Settings should ideally be saved to Supabase `app_settings` table, not just LocalStorage, so they apply to all staff.

## 6. API/Supabase Requirements

- **Table**: `system_settings` (Key-Value store).
- **Keys**: `modules_config`, `rental_policy`, `tax_rate`.
