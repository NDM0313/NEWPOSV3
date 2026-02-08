# Combos Feature - Complete Implementation Guide

## 📋 Implementation Status

### ✅ COMPLETED

#### PART 1: Feature Audit ✅
- ✅ Searched codebase for combo-related code
- ✅ Found combos UI in `EnhancedProductForm.tsx` (frontend only, not saved to DB)
- ✅ Confirmed: No database tables exist
- ✅ Confirmed: No backend service exists
- ✅ Confirmed: Sales flow does NOT handle combos
- ✅ Confirmed: Stock movements do NOT handle combos

#### PART 2: Module Toggle ✅
- ✅ Added `combosEnabled: boolean` to `ModuleToggles` interface
- ✅ Updated `SettingsContext.tsx`:
  - Added to default state (false)
  - Added to module loading
  - Added to `updateModules` function
  - Added to default stub
- ✅ Module toggle saved to `modules_config` table with `module_name='combos'`

#### PART 3: Database Tables ✅
- ✅ Created migration: `migrations/create_product_combos_tables.sql`
- ✅ Tables created:
  - `product_combos` - Combo definitions
  - `product_combo_items` - Combo components
- ✅ RLS policies added
- ✅ Helper functions created:
  - `get_combo_items(p_combo_id)`
  - `is_combo_product(p_product_id, p_company_id)`
  - `get_combo_id_for_product(p_product_id, p_company_id)`

#### PART 4: Backend Service ✅
- ✅ Created `src/app/services/comboService.ts`
- ✅ Methods:
  - `getCombos()` - Get all combos
  - `getComboById()` - Get combo with items
  - `getComboByProductId()` - Check if product is combo
  - `createCombo()` - Create combo with items
  - `updateCombo()` - Update combo
  - `updateComboItems()` - Replace combo items
  - `deleteCombo()` - Delete combo
  - `isComboProduct()` - Check if product is combo
  - `getComboItemsWithDetails()` - Get items with product details

#### PART 5: Frontend Integration ✅
- ✅ Updated `EnhancedProductForm.tsx`:
  - Added `useSettings()` hook
  - Conditionally show/hide Combos tab based on `modules.combosEnabled`
  - Combos tab only visible when `combosEnabled = true`

#### PART 6: Sales & Stock Handling ✅
- ✅ Updated `SalesContext.tsx`:
  - Added `comboService` import
  - Added `useSettings()` hook
  - Updated stock movement creation to handle combos:
    - Check if product is combo
    - If combo: Create stock movements for each combo item
    - If not combo: Create stock movement as normal
  - Virtual Bundle Model implemented:
    - Combo product itself does NOT get stock movement
    - Only component products get stock movements
    - Quantity: `combo_item.qty * sale_item.quantity`

### 🟡 IN PROGRESS / TODO

#### PART 7: Product Form - Save Combos to DB
- ⏳ Update `EnhancedProductForm.tsx` to:
  - Load existing combos from DB when editing product
  - Save combos to DB using `comboService.createCombo()`
  - Update combos when product is updated
  - Delete combos when product is deleted

#### PART 8: Sales UI - Combo Selection
- ⏳ Update Sales form to:
  - Show combo indicator when combo product selected
  - Display "Combo includes:" expandable list
  - Show component products and quantities
  - Validate combo availability before sale

#### PART 9: Validation
- ⏳ Add validation:
  - Check component stock availability
  - Respect `allow_negative_stock` setting
  - Require variation_id if component has variations
  - Block sale if any component out of stock (unless negative stock allowed)

#### PART 10: Settings UI
- ⏳ Add combos toggle to Settings page:
  - Module Settings section
  - Toggle: "Enable Product Combos"
  - Default: OFF

#### PART 11: Update Sale Edit Flow
- ⏳ Update `updateSale` in `SalesContext.tsx`:
  - Handle combo products in delta calculation
  - Create/update stock movements for combo components

## 📁 Files Created/Modified

### Created Files:
1. `migrations/create_product_combos_tables.sql` - Database migration
2. `src/app/services/comboService.ts` - Combo service
3. `COMBOS_FEATURE_IMPLEMENTATION.md` - This file

### Modified Files:
1. `src/app/context/SettingsContext.tsx` - Added combosEnabled toggle
2. `src/app/components/products/EnhancedProductForm.tsx` - Conditional combos tab
3. `src/app/context/SalesContext.tsx` - Combo stock handling

## 🗄️ Database Schema

### `product_combos`
```sql
- id UUID PK
- company_id UUID FK → companies(id)
- combo_product_id UUID FK → products(id) -- The product acting as bundle
- combo_name TEXT
- combo_price DECIMAL(15,2)
- is_active BOOLEAN
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

### `product_combo_items`
```sql
- id UUID PK
- company_id UUID FK → companies(id)
- combo_id UUID FK → product_combos(id)
- product_id UUID FK → products(id)
- variation_id UUID FK → product_variations(id) NULLABLE
- qty DECIMAL(15,2) -- Quantity of component in combo
- unit_price DECIMAL(15,2) NULLABLE -- Optional for costing
- created_at TIMESTAMPTZ
```

## 🔄 Stock Handling Model

### Virtual Bundle Model (Model A)

**Rule**: Combo product itself does NOT hold stock.

**On Sale FINAL of combo:**
1. For each `combo_item` in `product_combo_items`:
   - Create `stock_movements` row:
     - `product_id` = `combo_item.product_id` (component product)
     - `variation_id` = `combo_item.variation_id` (if exists)
     - `quantity` = `-(combo_item.qty * sale_item.quantity)`
     - `reference_type` = 'sale'
     - `reference_id` = `sale_id`
     - `notes` = "Combo sale: <combo_name>"

2. Do NOT create stock movement against `combo_product_id`.

**Example:**
- Combo "Wedding Package" includes:
  - Product A: 2 qty
  - Product B: 1 qty
- Sale: 3x "Wedding Package"
- Stock movements created:
  - Product A: -6 (2 * 3)
  - Product B: -3 (1 * 3)
- No movement for "Wedding Package" itself

## 🧪 Testing Checklist

### Test 1: Module Toggle OFF
- [ ] `combosEnabled = false`
- [ ] Combos tab hidden in Product Form
- [ ] No combo API calls allowed
- [ ] Settings page shows toggle OFF

### Test 2: Module Toggle ON
- [ ] `combosEnabled = true`
- [ ] Combos tab visible in Product Form
- [ ] Can create combo
- [ ] Combo saved to database
- [ ] Settings page shows toggle ON

### Test 3: Combo Sale
- [ ] Create combo with 2 items
- [ ] Sell combo qty=1
- [ ] `stock_movements` created for 2 items (negative)
- [ ] Inventory overview updates correctly
- [ ] Stock analytics shows movements with notes "Combo sale"
- [ ] No stock movement for combo product itself

### Test 4: Validation
- [ ] Component out of stock → warning/block (if negative stock not allowed)
- [ ] Component with variations → variation_id required
- [ ] Combo with no items → error

### Test 5: Sale Edit
- [ ] Edit sale with combo
- [ ] Stock movements updated correctly
- [ ] Delta calculation works for combo components

## 🚀 Next Steps

1. **Complete Product Form Integration**
   - Load combos from DB on edit
   - Save combos to DB on save
   - Use `comboService` instead of local state

2. **Update Sales UI**
   - Show combo details when combo product selected
   - Display component list
   - Add validation

3. **Add Settings UI**
   - Add toggle to Settings page

4. **Update Sale Edit Flow**
   - Handle combo products in delta calculation

5. **Testing**
   - Run all test cases
   - Verify stock movements
   - Verify inventory updates

## 📝 Notes

- **Virtual Bundle Model**: Combo products never hold stock
- **Stock Deduction**: Always from component products
- **Accounting**: Combo sale creates journal entry for combo price, but stock movements are for components
- **Variations**: Combo items can have variations - must specify variation_id
- **RLS**: All tables have RLS policies for company isolation

---

**Status**: Core implementation complete. Frontend integration and validation pending.
