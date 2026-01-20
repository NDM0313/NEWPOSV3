# 🔍 FIELD MAPPING VERIFICATION

## Date: 2026-01-20

## Purpose
Verify that all frontend form fields match database columns exactly.

---

## ✅ PRODUCTS TABLE

### Database Columns (Verified):
- `id` (UUID, PK)
- `company_id` (UUID, NOT NULL)
- `category_id` (UUID, nullable)
- `name` (VARCHAR, NOT NULL)
- `sku` (VARCHAR, NOT NULL)
- `barcode` (VARCHAR, nullable)
- `description` (TEXT, nullable)
- `cost_price` (DECIMAL, nullable)
- `retail_price` (DECIMAL, NOT NULL)
- `wholesale_price` (DECIMAL, nullable)
- `rental_price_daily` (DECIMAL, nullable)
- `current_stock` (DECIMAL, nullable)
- `min_stock` (DECIMAL, nullable)
- `max_stock` (DECIMAL, nullable)
- `has_variations` (BOOLEAN, nullable)
- `is_rentable` (BOOLEAN, nullable)
- `is_sellable` (BOOLEAN, nullable)
- `track_stock` (BOOLEAN, nullable)
- `is_active` (BOOLEAN, nullable)

### Frontend Form Fields (EnhancedProductForm.tsx):
```typescript
const productData = {
  company_id: finalCompanyId,          ✅
  category_id: categoryId,             ✅
  name: data.name,                     ✅
  sku: finalSKU,                       ✅
  barcode: barcodeValue,               ✅
  description: data.description,       ✅
  cost_price: data.purchasePrice,      ✅
  retail_price: data.sellingPrice,     ✅
  wholesale_price: data.wholesalePrice,✅
  rental_price_daily: data.rentalPrice,✅
  current_stock: data.stock,           ✅
  min_stock: data.lowStockThreshold,   ✅
  max_stock: data.maxStock,            ✅
  has_variations: generatedVariations.length > 0, ✅
  is_rentable: (data.rentalPrice || 0) > 0, ✅
  is_sellable: true,                   ✅
  track_stock: data.stockManagement,   ✅
  is_active: true,                      ✅
};
```

**Status**: ✅ **ALL FIELDS MATCH**

---

## ✅ CONTACTS TABLE

### Database Columns (Verified):
- `id` (UUID, PK)
- `company_id` (UUID, NOT NULL)
- `branch_id` (UUID, nullable)
- `type` (contact_type ENUM, NOT NULL)
- `name` (VARCHAR, NOT NULL)
- `email` (VARCHAR, nullable)
- `phone` (VARCHAR, nullable)
- `mobile` (VARCHAR, nullable)
- `cnic` (VARCHAR, nullable)
- `ntn` (VARCHAR, nullable)
- `address` (TEXT, nullable)
- `city` (VARCHAR, nullable)
- `state` (VARCHAR, nullable)
- `country` (VARCHAR, nullable)
- `postal_code` (VARCHAR, nullable)
- `tax_number` (VARCHAR, nullable)
- `opening_balance` (DECIMAL, nullable)
- `credit_limit` (DECIMAL, nullable)
- `payment_terms` (INTEGER, nullable)
- `notes` (TEXT, nullable)
- `is_active` (BOOLEAN, nullable)
- `created_by` (UUID, nullable)

### Frontend Form Fields (GlobalDrawer.tsx - ContactFormContent):
```typescript
const contactData = {
  company_id: companyId,               ✅
  branch_id: branchId,                 ✅
  type: contactType,                    ✅
  name: formData.get('business-name'),  ✅
  phone: formData.get('mobile'),        ✅
  email: formData.get('email'),         ✅
  address: formData.get('address'),     ✅
  city: formData.get('city'),           ✅
  country: country,                     ✅
  opening_balance: parseFloat(...),     ✅
  credit_limit: parseFloat(...),        ✅
  payment_terms: parseInt(...),         ✅
  tax_number: formData.get('tax-id'),   ✅
  notes: formData.get('notes'),         ✅
  created_by: user.id,                 ✅
};
```

**Missing Fields (Not sent but exist in DB):**
- `mobile` - Frontend sends `phone` only (both exist in DB, acceptable)
- `cnic` - Not in form (optional, acceptable)
- `ntn` - Not in form (optional, acceptable)
- `state` - Not in form (optional, acceptable)
- `postal_code` - Not in form (optional, acceptable)
- `is_active` - Defaults to true (acceptable)

**Status**: ✅ **ALL REQUIRED FIELDS MATCH** (Optional fields missing is OK)

---

## ⚠️ PRODUCT_VARIATIONS TABLE

### Database Columns (Need to verify):
- `id` (UUID, PK)
- `product_id` (UUID, NOT NULL)
- `sku` (VARCHAR, NOT NULL)
- `barcode` (VARCHAR, nullable)
- `attributes` (JSONB, NOT NULL)
- `price` (DECIMAL, nullable)
- `stock` (DECIMAL, nullable)
- `is_active` (BOOLEAN, nullable)

### Frontend Form Fields (EnhancedProductForm.tsx):
```typescript
const variationsToSave = generatedVariations.map(variation => ({
  product_id: result.id,               ✅
  name: Object.entries(...).join(...),  ❌ NOT IN SCHEMA
  sku: variation.sku,                  ✅
  barcode: variation.barcode,           ✅
  attributes: variation.combination,    ✅
  cost_price: variation.price,         ❌ WRONG COLUMN (should be `price`)
  retail_price: variation.price,       ❌ WRONG COLUMN (should be `price`)
  current_stock: variation.stock,      ❌ WRONG COLUMN (should be `stock`)
  is_active: true,                      ✅
}));
```

**ISSUE FOUND**: Product variations form sends wrong column names!

**Status**: ❌ **MISMATCH - NEEDS FIX**

---

## ✅ SETTINGS TABLE

### Database Columns (Verified):
- `id` (UUID, PK)
- `company_id` (UUID, NOT NULL)
- `key` (VARCHAR, NOT NULL)
- `value` (JSONB, NOT NULL)
- `category` (VARCHAR, nullable)
- `description` (TEXT, nullable)
- `updated_at` (TIMESTAMPTZ, nullable)

### Frontend Service (settingsService.ts):
```typescript
await supabase.from('settings').upsert({
  company_id: companyId,               ✅
  key,                                  ✅
  value,                                ✅
  category,                             ✅
  description,                          ✅
  updated_at: new Date().toISOString(), ✅
});
```

**Status**: ✅ **ALL FIELDS MATCH**

---

## ✅ CREATE BUSINESS TRANSACTION

### Database Function Signature (Verified):
```sql
create_business_transaction(
  p_business_name VARCHAR(255),
  p_owner_name VARCHAR(255),
  p_email VARCHAR(255),
  p_user_id UUID
)
```

### Frontend Service Call (businessService.ts):
```typescript
await supabaseAdmin.rpc('create_business_transaction', {
  p_business_name: data.businessName,  ✅
  p_owner_name: data.ownerName,        ✅
  p_email: data.email,                 ✅
  p_user_id: userId,                   ✅
});
```

**Status**: ✅ **FUNCTION SIGNATURE MATCHES**

---

## 🔧 FIXES REQUIRED

### 1. Product Variations Column Mismatch

**File**: `src/app/components/products/EnhancedProductForm.tsx`

**Current (WRONG)**:
```typescript
const variationsToSave = generatedVariations.map(variation => ({
  product_id: result.id,
  name: Object.entries(...).join(...),  // ❌ Not in schema
  sku: variation.sku,
  barcode: variation.barcode,
  attributes: variation.combination,
  cost_price: variation.price,         // ❌ Wrong column
  retail_price: variation.price,        // ❌ Wrong column
  current_stock: variation.stock,      // ❌ Wrong column
  is_active: true,
}));
```

**Should be (CORRECT)**:
```typescript
const variationsToSave = generatedVariations.map(variation => ({
  product_id: result.id,
  sku: variation.sku,
  barcode: variation.barcode || null,
  attributes: variation.combination,
  price: variation.price || null,      // ✅ Correct column
  stock: variation.stock || 0,         // ✅ Correct column
  is_active: true,
}));
```

---

## 📋 NEXT STEPS

1. ✅ Fix product variations column names
2. ✅ Verify all services use correct field names
3. ✅ Test Create Business flow
4. ✅ Test Settings persistence
5. ✅ Test Product CRUD
6. ✅ Test Contact CRUD
7. ✅ Hard persistence test
