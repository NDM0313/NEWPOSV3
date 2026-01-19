# Product Master - Complete Guide

## Overview
Modern, ERP-grade Product Master system for "Din Collection" Bridal Rental Management ERP. Supports simple products, variant products, and advanced packing/unit conversion.

## Access
Navigate to **Product Master** from the sidebar menu.

---

## Key Features

### 1. PRODUCT IDENTIFICATION
- **Product Name** (required) - Main product name
- **Auto-generated SKU** - Automatically created from product name, can be manually overridden
- **Internal Code** - Custom internal product code
- **Barcode** - Barcode support for scanning

### 2. CLASSIFICATION
- **Category** - Fabric, Accessories, Garments, etc.
- **Sub-category** - Cotton, Silk, Polyester, etc.
- **Brand** - Brand name
- **Product Type** - Simple / Variant / Service
  - **Simple**: Standard products with single SKU
  - **Variant**: Products with multiple variations (Size, Color, etc.)
  - **Service**: Service-based items

### 3. UNITS & MEASUREMENT
- **Base Unit** - Primary unit (Pcs, Box, Meter, Kg, Ltr)
- **Purchase Unit** - Unit for purchasing
- **Sale Unit** - Unit for selling
- **Unit Conversion** - Automatic conversion between units

### 4. VARIANTS (Conditional)
Only appears when **Product Type = Variant**

- **Variant Attributes** - Define attributes like Size, Color, Material
- **Add Attribute** - Click to add new variant attribute
- **Generate Variants** - Auto-create variant combinations
- **Individual Pricing** - Set prices per variant combination

### 5. PRICING & TAX
- **Purchase Price** - Cost price
- **Sale Price** - Selling price
- **Wholesale Price** - Optional bulk pricing
- **Tax Type** - GST, VAT, Sales Tax, None
- **Tax Percentage** - Tax rate (%)

### 6. INVENTORY CONTROL
- **Opening Stock** - Initial stock quantity
- **Reorder Level** - Minimum stock level for alerts
- **Warehouse** - Select warehouse location
- **Track Stock** - Enable/disable stock tracking
- **Low Stock Alert** - Get alerts when stock is low

### 7. PACKING SYSTEM
- **Enable Packing** - Toggle packing feature
- **Add Packing Level** - Define levels (Box, Pieces, Meter)
- **Conversion Factor** - Set conversion rates
- Example: 1 Box = 10 Pieces, 1 Piece = 2 Meters

### 8. STATUS & VISIBILITY
- **Status** - Active / Inactive
- **Enable for Sale** - Allow in sales transactions
- **Enable for Purchase** - Allow in purchase transactions

### 9. OPTIONAL FIELDS
- **Internal Notes** - Add notes about the product
- **Product Image** - Upload product image (planned)
- **Attachments** - Add documents (planned)

---

## Global UX Rules

### Numeric Input Behavior
✅ **Zero value** → Input appears empty  
✅ **Non-zero value** → Auto-selects on focus  
✅ **Typing** → Instantly replaces old value

### Status Color Behavior (Planned)
- Draft → Grey
- Quotation → Yellow
- Order → Blue
- Final → Green

---

## Product List Features

### Search & Filter
- **Search** - By product name, SKU, or brand
- **Category Filter** - Filter by category
- **Type Filter** - Filter by product type
- **Status Filter** - Active/Inactive

### Product Table
Displays:
- SKU (with monospace font)
- Product Name
- Category
- Brand
- Type (with color badges)
- Sale Price
- Stock (color-coded: Red < 100, Yellow < 500, Green ≥ 500)
- Status badge
- Actions (Edit, Delete)

### Quick Actions
- **Edit** - Modify existing product
- **Delete** - Remove product (with confirmation)
- **New Product** - Create new product

---

## Tab Navigation

The Product Master form has 5 tabs:

1. **Basic Info** - Identification, Classification, Units, Status
2. **Variants** - Only visible for Variant products
3. **Pricing & Tax** - Price configuration and tax settings
4. **Inventory** - Stock management and warehouse
5. **Packing** - Packing levels and conversion

---

## Workflow

### Creating a Simple Product
1. Click **New Product**
2. Enter **Product Name** (SKU auto-generates)
3. Select **Category**, **Sub-category**, **Brand**
4. Keep **Product Type** as **Simple**
5. Configure **Units** (Base, Purchase, Sale)
6. Go to **Pricing & Tax** tab
7. Enter prices and tax information
8. Go to **Inventory** tab
9. Set opening stock and reorder level
10. Click **Save Product**

### Creating a Variant Product
1. Click **New Product**
2. Enter **Product Name**
3. Change **Product Type** to **Variant**
4. Go to **Variants** tab (now visible)
5. Add variant attributes (e.g., "Size", "Color")
6. Click **Generate Variants** to create combinations
7. Set individual pricing for each variant
8. Configure other tabs as needed
9. Click **Save Product**

### Enabling Packing
1. Open product (new or existing)
2. Go to **Packing** tab
3. Enable **Enable Packing** checkbox
4. Click **Add Packing Level**
5. Enter level name (e.g., "Box")
6. Enter conversion factor (e.g., 10 for "1 Box = 10 Pcs")
7. Add more levels as needed
8. Save product

---

## Integration

The Product Master is integrated with:
- ✅ Sale Module (product selection)
- ✅ Purchase Module (product selection)
- ✅ Inventory Module (stock tracking)
- ✅ POS System (product lookup)

---

## Keyboard Shortcuts

- **Enter** - Save product (when in form)
- **Escape** - Close modal
- **Tab** - Navigate between fields

---

## Best Practices

1. **Use clear product names** - Make them searchable
2. **Let SKU auto-generate** - Override only if needed
3. **Configure packing for bulk items** - Saves time in transactions
4. **Enable low stock alerts** - Never run out of stock
5. **Use variants wisely** - Only for products with actual variations
6. **Keep notes updated** - Document important product info
7. **Set realistic reorder levels** - Based on sales velocity

---

## Technical Details

- **Dark Mode**: Strict #111827 theme
- **Responsive**: Works on all screen sizes
- **Tab-based Navigation**: Clean, organized interface
- **Validation**: Required fields enforced
- **Auto-save**: Quick save with keyboard shortcuts

---

## Future Enhancements (Planned)

- [ ] Bulk import/export (CSV, Excel)
- [ ] Product image upload
- [ ] Barcode generation/printing
- [ ] Advanced variant matrix view
- [ ] Product bundles
- [ ] Multi-warehouse stock view
- [ ] Product history/audit log
- [ ] Quick duplicate product feature
- [ ] Advanced search with filters

---

## Support

For issues or feature requests, refer to the main ERP documentation or contact the development team.

**Last Updated**: January 2026
**Version**: 1.0.0
