# Standard Wholesale System - Complete Redesign 📦

**Din Collection ERP - Status + Variation + Packing Standard Method**

---

## 🎯 Overview

Complete redesign with **3 major additions**:

1. **Status Field** - Draft, Quotation, Order, Final
2. **Standard Variations** - Size + Color (separate fields)
3. **Standard Packing** - Thaans + Meters (wholesale method)

---

## 📊 Sale Status System

### **Status Types:**

```typescript
type SaleStatus = 'draft' | 'quotation' | 'order' | 'final';
```

### **Status Flow:**

```
Draft → Quotation → Order → Final
  ⬇️        ⬇️         ⬇️       ⬇️
 Gray     Yellow     Blue    Green
```

### **Visual Design:**

| Status | Color | Icon | Use Case |
|--------|-------|------|----------|
| **Draft** | Gray | 📄 | Initial entry, not confirmed |
| **Quotation** | Yellow | 📄 | Price quotation sent to customer |
| **Order** | Blue | 🛍️ | Confirmed order, awaiting processing |
| **Final** | Green | ✅ | Completed & finalized |

### **Header Implementation:**

```tsx
<Select value={saleStatus} onValueChange={setSaleStatus}>
    <SelectTrigger className={getStatusColor()}>
        {getStatusIcon()}
        <SelectValue />
    </SelectTrigger>
    <SelectContent>
        <SelectItem value="draft">
            <span className="w-2 h-2 bg-gray-500"></span>
            Draft
        </SelectItem>
        <SelectItem value="quotation">
            <span className="w-2 h-2 bg-yellow-500"></span>
            Quotation
        </SelectItem>
        <SelectItem value="order">
            <span className="w-2 h-2 bg-blue-500"></span>
            Order
        </SelectItem>
        <SelectItem value="final">
            <span className="w-2 h-2 bg-green-500"></span>
            Final
        </SelectItem>
    </SelectContent>
</Select>
```

---

## 🎨 Standard Variation System

### **Old Method (Dropdown):**
```
❌ [Variation: Red / Medium ▼]
   - Combined field
   - Not flexible
   - Hard to filter
```

### **New Method (Separate Fields):**
```
✅ [Size ▼] [Color ▼]
   - Independent fields
   - Easy to filter
   - Standard across industry
```

### **Size Options:**

```typescript
const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
```

### **Color Options:**

```typescript
const colors = ['Red', 'Blue', 'Black', 'White', 'Green'];
```

### **Visual Design:**

```
┌──────────────────────────────────────────────┐
│ 🔍 Find Product                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Silk Dupatta ✕                           │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

    ⬇️ Product Selected (hasVariations: true)

┌──────────────────────────────────────────────────────┐
│ 🔍 Product    Size    Color    Qty   Price   [Add]  │
│ ┌──────────┐ ┌────┐ ┌─────┐ ┌───┐ ┌─────┐ ┌──────┐ │
│ │ Dupatta✕ │ │ M ▼│ │Red▼ │ │ 1 │ │1800 │ │⬇Add │ │
│ └──────────┘ └────┘ └─────┘ └───┘ └─────┘ └──────┘ │
│              🟣      🟣                               │
└──────────────────────────────────────────────────────┘
```

### **Implementation:**

```tsx
{pendingProduct && pendingProduct.hasVariations && (
    <>
        {/* Size Field */}
        <div className="w-28 lg:w-32">
            <Label className="text-xs text-purple-400">Size</Label>
            <Select value={pendingSize} onValueChange={setPendingSize}>
                <SelectTrigger className="h-11 bg-gray-900 border-purple-500/50">
                    <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="S">Small</SelectItem>
                    <SelectItem value="M">Medium</SelectItem>
                    <SelectItem value="L">Large</SelectItem>
                    <SelectItem value="XL">X-Large</SelectItem>
                    <SelectItem value="XXL">XX-Large</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {/* Color Field */}
        <div className="w-28 lg:w-32">
            <Label className="text-xs text-purple-400">Color</Label>
            <Select value={pendingColor} onValueChange={setPendingColor}>
                <SelectTrigger className="h-11 bg-gray-900 border-purple-500/50">
                    <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Red">Red</SelectItem>
                    <SelectItem value="Blue">Blue</SelectItem>
                    <SelectItem value="Black">Black</SelectItem>
                    <SelectItem value="White">White</SelectItem>
                    <SelectItem value="Green">Green</SelectItem>
                </SelectContent>
            </Select>
        </div>
    </>
)}
```

---

## 📦 Standard Packing System (Wholesale)

### **Old Method (Modal):**
```
❌ Click "Add Packing" → Modal opens → Complex entry
   - Too many steps
   - Not quick entry
   - Breaks flow
```

### **New Method (Inline Fields):**
```
✅ [Thaans: 3] [Meters: 45]
   - Direct entry
   - Quick and simple
   - Standard wholesale format
```

### **Packing Fields:**

| Field | Description | Example |
|-------|-------------|---------|
| **Thaans** | Number of bundles/rolls | 3 |
| **Meters** | Total meters of fabric | 45.5 |

### **Visual Design:**

```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 Product          Thaans  Meters   Qty   Price     [Add]  │
│ ┌────────────────┐ ┌─────┐ ┌─────┐ ┌───┐ ┌──────┐ ┌──────┐ │
│ │ Cotton Fabric✕ │ │  3  │ │ 45  │ │ 1 │ │ 850  │ │⬇Add │ │
│ └────────────────┘ └─────┘ └─────┘ └───┘ └──────┘ └──────┘ │
│                     🟠      🟠                                │
└──────────────────────────────────────────────────────────────┘
```

### **Implementation:**

```tsx
{pendingProduct && pendingProduct.needsPacking && (
    <>
        {/* Thaans Field */}
        <div className="w-24 lg:w-28">
            <Label className="text-xs text-orange-400">Thaans</Label>
            <Input
                type="number"
                value={pendingThaans || ""}
                onChange={(e) => setPendingThaans(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="h-11 bg-gray-900 border-orange-500/50 text-center font-bold text-orange-400"
            />
        </div>

        {/* Meters Field */}
        <div className="w-28 lg:w-32">
            <Label className="text-xs text-orange-400">Meters</Label>
            <Input
                type="number"
                value={pendingMeters || ""}
                onChange={(e) => setPendingMeters(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="h-11 bg-gray-900 border-orange-500/50 text-center font-bold text-orange-400"
            />
        </div>
    </>
)}
```

---

## 📋 Item Data Structure

### **Updated Interface:**

```typescript
interface SaleItem {
    id: number;
    productId: number;
    name: string;
    sku: string;
    price: number;
    qty: number;
    // Standard Variation Fields
    size?: string;       // ← New: "S", "M", "L", etc.
    color?: string;      // ← New: "Red", "Blue", etc.
    // Standard Packing Fields (Wholesale)
    thaans?: number;     // ← New: Number of thaans
    meters?: number;     // ← New: Total meters
    packingDetails?: PackingDetails; // Old: Still supported
}
```

### **Example Items:**

#### **1. Simple Product:**
```json
{
    "name": "Chiffon Fabric",
    "sku": "CHF-078",
    "price": 950,
    "qty": 5
}
```

#### **2. Product with Variations:**
```json
{
    "name": "Silk Dupatta",
    "sku": "SLK-022",
    "price": 1800,
    "qty": 2,
    "size": "M",
    "color": "Red"
}
```

#### **3. Product with Packing:**
```json
{
    "name": "Premium Cotton",
    "sku": "FAB-001",
    "price": 850,
    "qty": 1,
    "thaans": 3,
    "meters": 45
}
```

#### **4. Product with Both:**
```json
{
    "name": "Designer Lawn",
    "sku": "LWN-099",
    "price": 1200,
    "qty": 1,
    "size": "L",
    "color": "Blue",
    "thaans": 2,
    "meters": 30
}
```

---

## 🎨 Table Display

### **Product Details Column:**

```tsx
<TableCell>
    <div>
        {/* Product Name */}
        <div className="font-medium text-white">
            {item.name}
        </div>
        
        {/* SKU + Variations */}
        <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="font-mono">{item.sku}</span>
            
            {/* Size Badge */}
            {item.size && (
                <>
                    <span className="text-gray-700">•</span>
                    <Badge className="bg-purple-900/30 text-purple-400 border-purple-500/30">
                        {item.size}
                    </Badge>
                </>
            )}
            
            {/* Color Badge */}
            {item.color && (
                <>
                    <span className="text-gray-700">•</span>
                    <Badge className="bg-purple-900/30 text-purple-400 border-purple-500/30">
                        {item.color}
                    </Badge>
                </>
            )}
        </div>
    </div>
</TableCell>
```

### **Packing Info Column:**

```tsx
<TableCell>
    {item.thaans || item.meters ? (
        <div className="flex items-center gap-2">
            {/* Thaans Badge */}
            {item.thaans && (
                <Badge className="bg-orange-900/30 text-orange-400 border-orange-500/30">
                    <Box size={10} className="mr-1" />
                    {item.thaans} Th
                </Badge>
            )}
            
            {/* Meters Badge */}
            {item.meters && (
                <Badge className="bg-orange-900/30 text-orange-400 border-orange-500/30">
                    <Ruler size={10} className="mr-1" />
                    {item.meters}M
                </Badge>
            )}
        </div>
    ) : (
        <span className="text-gray-600">—</span>
    )}
</TableCell>
```

### **Visual Example:**

```
┌────┬────────────────────────────────────┬─────────────────┬──────┬─────┬────────┬───┐
│ #  │ Product Details                    │ Packing Info    │Price │ Qty │ Total  │ X │
├────┼────────────────────────────────────┼─────────────────┼──────┼─────┼────────┼───┤
│ 01 │ Silk Dupatta                       │ —               │ 1800 │  2  │ 3,600  │🗑️│
│    │ SLK-022 • [M] • [Red]              │                 │      │     │        │   │
├────┼────────────────────────────────────┼─────────────────┼──────┼─────┼────────┼───┤
│ 02 │ Premium Cotton Fabric              │ [📦 3 Th]       │  850 │  1  │   850  │🗑️│
│    │ FAB-001                            │ [📏 45M]        │      │     │        │   │
├────┼────────────────────────────────────┼─────────────────┼──────┼─────┼────────┼───┤
│ 03 │ Lawn Print Floral                  │ [📦 5 Th]       │ 1250 │  1  │ 1,250  │🗑️│
│    │ LWN-045 • [L] • [Blue]             │ [📏 75M]        │      │     │        │   │
└────┴────────────────────────────────────┴─────────────────┴──────┴─────┴────────┴───┘
```

---

## 🔄 Entry Flow Examples

### **Example 1: Variation Product (Dupatta)**

```
Step 1: Search "Dupatta"
┌──────────────────────────┐
│ 🔍 Scan barcode...       │
│    Dupatta_              │ ← User types
└──────────────────────────┘

Step 2: Select from dropdown
✓ Silk Dupatta (SLK-022)

Step 3: Conditional fields appear
┌──────────────────────────────────────────────────────┐
│ 🔍 Silk Dupatta ✕  [Size▼] [Color▼] [Qty] [Price]  │
│                     🟣      🟣                        │
└──────────────────────────────────────────────────────┘

Step 4: Fill fields
Size: M
Color: Red
Qty: 2
Price: 1800 (auto-filled)

Step 5: Click "Add" or Press Enter
✓ Item added to list with size & color badges
```

---

### **Example 2: Packing Product (Fabric)**

```
Step 1: Search "Cotton"
Step 2: Select "Premium Cotton Fabric"

Step 3: Conditional fields appear
┌──────────────────────────────────────────────────────────┐
│ 🔍 Cotton ✕  [Thaans] [Meters] [Qty] [Price] [Add]     │
│               🟠       🟠                                 │
└──────────────────────────────────────────────────────────┘

Step 4: Fill packing details
Thaans: 3
Meters: 45
Qty: 1
Price: 850

Step 5: Add to list
✓ Item shows packing badges: [📦 3 Th] [📏 45M]
```

---

### **Example 3: Product with Both**

```
Step 1: Select product with variations + packing

Step 2: All fields appear
┌───────────────────────────────────────────────────────────────────┐
│ 🔍 Product ✕  [Size] [Color] [Thaans] [Meters] [Qty] [Price]    │
│                🟣     🟣      🟠       🟠                          │
└───────────────────────────────────────────────────────────────────┘

Step 3: Fill all fields
Size: L
Color: Blue
Thaans: 2
Meters: 30
Qty: 1
Price: 1200

Step 4: Add
✓ Shows both variation AND packing badges
```

---

## 🎯 Color Coding Reference

| Feature | Color | Usage |
|---------|-------|-------|
| **Status - Draft** | Gray | `text-gray-500 bg-gray-900/50` |
| **Status - Quotation** | Yellow | `text-yellow-500 bg-yellow-900/20` |
| **Status - Order** | Blue | `text-blue-500 bg-blue-900/20` |
| **Status - Final** | Green | `text-green-500 bg-green-900/20` |
| **Find Product** | Blue | `text-blue-400` |
| **Variation (Size/Color)** | Purple | `text-purple-400` |
| **Packing (Thaans/Meters)** | Orange | `text-orange-400` |
| **Standard Fields** | Gray | `text-gray-400` |

---

## 📱 Responsive Design

### **Desktop (lg:):**
```
[Find Product (flex-1)] [Size (w-32)] [Color (w-32)] [Thaans (w-28)] [Meters (w-32)] [Qty (w-28)] [Price (w-36)] [Add]
```

### **Mobile (<lg):**
```
[Find Product (w-full)]
[Size (w-full)]
[Color (w-full)]
[Thaans (w-full)]
[Meters (w-full)]
[Qty (w-full)]
[Price (w-full)]
[Add (w-full)]
```

---

## 🔧 State Management

```typescript
// Status
const [saleStatus, setSaleStatus] = useState<'draft' | 'quotation' | 'order' | 'final'>('draft');

// Variation States
const [pendingSize, setPendingSize] = useState<string>("");
const [pendingColor, setPendingColor] = useState<string>("");

// Packing States
const [pendingThaans, setPendingThaans] = useState<number>(0);
const [pendingMeters, setPendingMeters] = useState<number>(0);
```

---

## ✅ Validation Rules

### **Variations:**
- Optional for all products
- Only show if `product.hasVariations === true`
- Can select size only, color only, or both

### **Packing:**
- Optional for all products
- Only show if `product.needsPacking === true`
- Can enter thaans only, meters only, or both
- Must be >= 0

### **Commit Item:**
```typescript
const commitPendingItem = () => {
    // Basic validation
    if (!pendingProduct) {
        toast.error("Please select a product first");
        return;
    }
    if (pendingQty <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
    }
    
    // Create item with optional fields
    const newItem: SaleItem = {
        id: Date.now(),
        productId: pendingProduct.id,
        name: pendingProduct.name,
        sku: pendingProduct.sku,
        price: pendingPrice,
        qty: pendingQty,
        // Only add if provided
        size: pendingSize || undefined,
        color: pendingColor || undefined,
        thaans: pendingThaans > 0 ? pendingThaans : undefined,
        meters: pendingMeters > 0 ? pendingMeters : undefined,
    };
    
    setItems([...items, newItem]);
    resetEntryRow();
};
```

---

## 🎬 Reset Logic

```typescript
const resetEntryRow = () => {
    setPendingProduct(null);
    setProductSearchTerm("");
    setPendingQty(1);
    setPendingPrice(0);
    // Reset variations
    setPendingSize("");
    setPendingColor("");
    // Reset packing
    setPendingThaans(0);
    setPendingMeters(0);
    
    // Focus back to search
    setTimeout(() => {
        searchInputRef.current?.focus();
    }, 50);
};
```

---

## 🌟 Benefits

### **1. Status System:**
- ✅ Clear workflow tracking
- ✅ Visual distinction (color-coded)
- ✅ Works for quotations, orders, finals
- ✅ Standard across all transactions

### **2. Separate Size/Color:**
- ✅ Industry standard approach
- ✅ Easy to filter & report
- ✅ Independent selection
- ✅ More flexible than combined dropdown

### **3. Inline Packing:**
- ✅ Quick wholesale entry
- ✅ No modal interruption
- ✅ Standard thaans/meters format
- ✅ Matches real-world process

---

## 📊 Use Cases

### **Retail Sale:**
```
Product: Suit
Size: L
Color: Blue
Thaans: —
Meters: —
Qty: 1
```

### **Wholesale Fabric Sale:**
```
Product: Cotton Fabric
Size: —
Color: —
Thaans: 5
Meters: 75
Qty: 1
```

### **Mixed Sale:**
```
Product: Designer Lawn
Size: XL
Color: Red
Thaans: 3
Meters: 45
Qty: 1
```

---

## 🎯 Summary

### **Three Major Updates:**

1. **Status Field** (Header)
   - Draft → Quotation → Order → Final
   - Color-coded visual system
   - Works for all transaction types

2. **Standard Variations** (Items Entry)
   - Separate Size & Color fields
   - Purple accent color
   - Only shows if product has variations

3. **Standard Packing** (Items Entry)
   - Inline Thaans & Meters fields
   - Orange accent color
   - Quick wholesale entry

---

**Perfect for wholesale textile business!** 📦✨

**All systems work together seamlessly for complete transaction management from quotation to final delivery!** 🎯
