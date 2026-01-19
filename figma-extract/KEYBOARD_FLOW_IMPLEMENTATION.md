# Keyboard-Driven Item Entry Flow

## Overview
Implemented strict keyboard-driven workflow for Sale and Purchase item entry that enables fast, professional ERP data entry without requiring mouse interaction.

## Keyboard Flow Sequence

### 1. Product Search (Enter Key Behavior)
When Enter is pressed on a highlighted product:
- **If product has variations**: Display variation list (do NOT auto-select product)
- **If product has NO variations**: Set as pending product and move focus to Quantity field

### 2. Variation Selection (Enter Key Behavior)
When Enter is pressed on a selected variation:
- Set product with variation as pending
- Move focus to Quantity field
- Value is selected for quick replacement

### 3. Quantity Entry (Enter Key Behavior)
When Enter is pressed after entering quantity:
- Move focus to Unit Price field
- Value is selected for quick replacement

### 4. Unit Price Entry (Enter Key Behavior)
When Enter is pressed after entering price:
- Confirm and add the item to the list
- Reset all pending fields
- Automatically open Product Search
- Move focus back to Product Search input for next item

## Key Features

### Predictable Navigation
- Tab-free workflow using only Enter key
- Arrow keys for product/variation selection
- Automatic field-to-field progression

### Smart Defaults
- Default price is auto-filled from product
- Default quantity is 1
- Field values are pre-selected for quick replacement

### Continuous Entry
- After adding item, search automatically reopens
- Focus returns to search input
- No need to click or manually navigate

### Variation Handling
- Variations cannot be skipped if they exist
- Inline variation selector with keyboard support
- Enter key on variation moves to quantity field

## Implementation Details

### Modified Components

1. **InlineVariationSelector** (`/src/app/components/ui/inline-variation-selector.tsx`)
   - Added `focusNextField` callback prop
   - Calls callback after variation selection with Enter key

2. **SaleForm** (`/src/app/components/sales/SaleForm.tsx`)
   - Updated `handleSelectProduct` to set pending product instead of auto-adding
   - Updated `handleVariationSelect` to set pending product with variation
   - Updated `commitPendingItem` to auto-reopen search and focus input
   - Added `.select()` calls to quantity and price inputs for quick replacement

3. **PurchaseForm** (`/src/app/components/purchases/PurchaseForm.tsx`)
   - Updated `handleSelectProduct` to set pending product instead of auto-adding
   - Updated `handleVariationSelect` to set pending product with variation
   - Updated `handleAddItem` to auto-reopen search and focus input

4. **PurchaseItemsSection** (`/src/app/components/purchases/PurchaseItemsSection.tsx`)
   - Added `focusNextField` callback to InlineVariationSelector
   - Updated Enter key handlers for quantity and price inputs
   - Fixed priceInputRef type from HTMLButtonElement to HTMLInputElement

## Benefits

1. **Speed**: Fast data entry without mouse interaction
2. **Predictability**: Same behavior every time
3. **Professional**: Standard ERP keyboard workflow
4. **Efficiency**: Continuous entry loop for multiple items
5. **Consistency**: Identical behavior in Sale and Purchase modules

## Usage Example

```
1. [Search opens automatically]
2. Type "fabric" → [filters products]
3. Press ↓ to highlight → Press Enter
4. [If variations] → Press ↓ to select → Press Enter
5. [Quantity field focused] → Type "5" → Press Enter
6. [Price field focused] → Type "1250" → Press Enter
7. [Item added, search reopens, cursor in search]
8. Type next product name...
```

## Testing Checklist

- [x] Product without variations: Enter → Quantity → Price → Add
- [x] Product with variations: Enter → Select Variation → Quantity → Price → Add
- [x] Focus returns to search after adding item
- [x] Field values are selected when focused
- [x] Search automatically opens after adding item
- [x] Identical behavior in Sale and Purchase modules
- [x] Variation selection cannot be skipped
- [x] Default price is populated from product
- [x] Default quantity is 1
