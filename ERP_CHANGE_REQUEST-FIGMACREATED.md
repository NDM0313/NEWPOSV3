# ERP CHANGE REQUEST - Mobile UI Alignment

**LOCKED DESIGN BASELINE:** Figma Mobile ERP App Design  
**TASK:** Document differences between Figma and implementation  
**NO NEW FEATURES:** Only align existing to Figma spec

---

## 📋 CHANGES REQUIRED

### CHANGE 1: Bottom Navigation - Layout & Styling

**Figma Screen:** HomeScreen + BottomNav  
**Component:** `/src/app/components/layout/BottomNav.tsx`  
**Status:** ⚠️ INCORRECT IMPLEMENTATION

**Missing/Incorrect:**
1. **Background color:** Currently `bg-gray-900`, Figma shows `bg-[#1f2937]`
2. **Border:** Currently `border-t border-gray-800`, Figma shows `border-black border-solid border-t-[0.749px]`
3. **Height:** Currently `h-16`, Figma shows `h-[67.98px]` (≈68px or 4.25rem)
4. **Center FAB styling:** Currently blue gradient with Store icon, Figma shows:
   - White POS/Shopping icon
   - `bg-[#3b82f6]` background
   - Shadow: `shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]`
   - Size: `size-[55.992px]` (≈56px or 3.5rem)
   - Position: `top-[-6.75px]` (raised above nav)

**Expected Behavior:**
```tsx
// Bottom nav container
className="bg-[#1f2937] border-t border-black h-[68px]"

// Center FAB
className="absolute left-1/2 -translate-x-1/2 -top-[6.75px] bg-[#3b82f6] rounded-full w-14 h-14 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]"
```

**Figma Status:** ✅ This change already exists in Figma (line 710)

---

### CHANGE 2: Bottom Navigation - Button Order

**Figma Screen:** BottomNav  
**Component:** `/src/app/components/layout/BottomNav.tsx`  
**Status:** ⚠️ INCORRECT ORDER

**Current Order:**
1. Dashboard (Home)
2. Sales
3. POS (Center FAB)
4. Contacts
5. More

**Figma Order:**
1. Home (line 567-573: Button9)
2. Sales (line 605-611: Button10)
3. POS (Center FAB) (line 700-705: Button13)
4. Contacts (line 639-645: Button11)
5. More (line 672-678: Button12)

**Expected Behavior:**
Order is CORRECT, but labels need verification:
- Button 1: "Home" (active: `text-[#3b82f6]`)
- Button 2: "Sales" (inactive: `text-[#9ca3af]`)
- Button 3: POS (center white icon)
- Button 4: "Contacts" (inactive: `text-[#9ca3af]`)
- Button 5: "More" (inactive: `text-[#9ca3af]`)

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 3: Dashboard Header - Exact Sizing

**Figma Screen:** HomeScreen > Container7  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx`  
**Status:** ⚠️ APPROXIMATE IMPLEMENTATION

**Current Implementation:**
```tsx
<div className="bg-gradient-to-b from-gray-800 to-gray-900 p-6 pb-8">
```

**Figma Specification (line 164-169):**
```tsx
className="bg-gradient-to-b from-[#1f2937] to-[#111827] h-[237.42px]"
// Padding: pt-[23.998px] px-[23.998px] pb-0
```

**Missing/Incorrect:**
1. From color: `from-gray-800` → `from-[#1f2937]`
2. To color: `to-gray-900` → `to-[#111827]`
3. Height: Not set → Should be `h-[237.42px]` or `min-h-[237px]`
4. Padding: `p-6 pb-8` → `pt-6 px-6 pb-0`

**Expected Behavior:**
```tsx
<div className="bg-gradient-to-b from-[#1f2937] to-[#111827] pt-6 px-6 pb-0 min-h-[237px]">
```

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 4: Dashboard Stats Cards - Border & Background

**Figma Screen:** HomeScreen > Container4 & Container5  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx` (lines 61-70)  
**Status:** ⚠️ APPROXIMATE STYLING

**Current Implementation:**
```tsx
<div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
```

**Figma Specification (line 119-124):**
```tsx
className="bg-[rgba(17,24,39,0.5)] rounded-[14px] pt-[16.74px] px-[16.74px] pb-[0.749px]"
// Border: border-[#374151] border-[0.749px]
```

**Missing/Incorrect:**
1. Background: `bg-gray-900/50` → `bg-[rgba(17,24,39,0.5)]` (same opacity, explicit)
2. Border color: `border-gray-700` → `border-[#374151]`
3. Border width: `border` (1px) → `border-[0.749px]`
4. Padding: `p-4` (16px) → Custom padding per Figma

**Expected Behavior:**
```tsx
<div className="bg-[rgba(17,24,39,0.5)] border border-[#374151] rounded-[14px] p-4">
```

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 5: Module Grid Cards - Border & Sizing

**Figma Screen:** HomeScreen > Container16 > Button1-8  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx` (lines 77-90)  
**Status:** ⚠️ APPROXIMATE SIZING

**Current Implementation:**
```tsx
<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl">
```

**Figma Specification (line 213-217):**
```tsx
// Card
className="bg-[#1f2937] border-[#374151] border-[0.749px] h-[149.48px] w-[197.407px] rounded-[16px]"

// Icon container
className="bg-[rgba(59,130,246,0.1)] rounded-[16px] size-[63.999px]"
// Position: left-[65.95px] top-[24px] (centered)
```

**Missing/Incorrect:**
1. Card background: `bg-gray-900` → `bg-[#1f2937]`
2. Border color: `border-gray-800` → `border-[#374151]`
3. Border width: `border` (1px) → `border-[0.749px]`
4. Border radius: `rounded-2xl` (16px) → `rounded-[16px]` ✓ (same)
5. Icon container: `w-16 h-16` (64px) → `size-[63.999px]` ≈ `w-16 h-16` ✓
6. Icon container radius: `rounded-2xl` → `rounded-[16px]` ✓

**Expected Behavior:**
```tsx
<button className="bg-[#1f2937] border-[#374151] border-[0.749px] rounded-[16px] p-6 flex flex-col items-center justify-center gap-3">
  <div className="w-16 h-16 bg-[rgba(59,130,246,0.1)] rounded-[16px] flex items-center justify-center">
    <Icon size={32} className="text-[#3B82F6]" />
  </div>
  <span className="text-[#f9fafb] text-[14px]">Sales</span>
</button>
```

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 6: Module Icons - Exact Colors

**Figma Screen:** All module buttons  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx`  
**Status:** ⚠️ TAILWIND APPROXIMATIONS

**Current Color Mapping:**
```tsx
Sales:      bg-blue-500/10 + text-blue-500
Purchase:   bg-green-500/10 + text-green-500
Rental:     bg-purple-500/10 + text-purple-500
Studio:     bg-pink-500/10 + text-pink-500
Accounting: bg-amber-500/10 + text-amber-500
Expense:    bg-red-500/10 + text-red-500
Packing:    bg-cyan-500/10 + text-cyan-500
Contacts:   bg-indigo-500/10 + text-indigo-500
```

**Figma Exact Colors:**
```tsx
// Line 197-198: Sales
bg-[rgba(59,130,246,0.1)] + stroke="#3B82F6"

// Line 235-236: Purchase
bg-[rgba(16,185,129,0.1)] + stroke="#10B981"

// Line 272-273: Rental
bg-[rgba(139,92,246,0.1)] + stroke="#8B5CF6"

// Line 310-311: Studio
bg-[rgba(236,72,153,0.1)] + stroke="#EC4899"

// Line 348-349: Accounting
bg-[rgba(245,158,11,0.1)] + stroke="#F59E0B"

// Line 387-388: Expense
bg-[rgba(239,68,68,0.1)] + stroke="#EF4444"

// Line 427-428: Packing
bg-[rgba(6,182,212,0.1)] + stroke="#06B6D4"

// Line 465-466: Contacts
bg-[rgba(99,102,241,0.1)] + stroke="#6366F1"
```

**Expected Behavior:**
```tsx
const modulesList = [
  { id: 'sales', label: 'Sales', icon: ShoppingBag, 
    color: 'bg-[rgba(59,130,246,0.1)]', iconColor: 'text-[#3B82F6]' },
  { id: 'purchases', label: 'Purchase', icon: Receipt, 
    color: 'bg-[rgba(16,185,129,0.1)]', iconColor: 'text-[#10B981]' },
  { id: 'rentals', label: 'Rental', icon: Shirt, 
    color: 'bg-[rgba(139,92,246,0.1)]', iconColor: 'text-[#8B5CF6]' },
  { id: 'studio', label: 'Studio', icon: Camera, 
    color: 'bg-[rgba(236,72,153,0.1)]', iconColor: 'text-[#EC4899]' },
  { id: 'accounting', label: 'Accounting', icon: DollarSign, 
    color: 'bg-[rgba(245,158,11,0.1)]', iconColor: 'text-[#F59E0B]' },
  { id: 'expenses', label: 'Expense', icon: TrendingUp, 
    color: 'bg-[rgba(239,68,68,0.1)]', iconColor: 'text-[#EF4444]' },
  { id: 'inventory', label: 'Packing', icon: Box, 
    color: 'bg-[rgba(6,182,212,0.1)]', iconColor: 'text-[#06B6D4]' },
  { id: 'contacts', label: 'Contacts', icon: UserCircle, 
    color: 'bg-[rgba(99,102,241,0.1)]', iconColor: 'text-[#6366F1]' },
];
```

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 7: Module Labels - Exact Text

**Figma Screen:** All module buttons  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx`  
**Status:** ✅ CORRECT (minor note)

**Current Labels:**
- Sales ✓
- Purchase ✓ (Figma line 245)
- Rental ✓ (Figma line 282)
- Studio ✓ (Figma line 320)
- Accounting ✓ (Figma line 358)
- Expense ✓ (Figma line 397)
- Packing ✓ (Figma line 437)
- Contacts ✓ (Figma line 475)

**Expected Behavior:**
All labels are correct. No change needed.

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 8: Bottom Hint Card - Exact Styling

**Figma Screen:** HomeScreen > Container17  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx` (lines 93-97)  
**Status:** ⚠️ APPROXIMATE STYLING

**Current Implementation:**
```tsx
<div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-3">
  <p className="text-gray-500 text-xs text-center">
    Use bottom navigation to switch between modules quickly
  </p>
</div>
```

**Figma Specification (line 514-520):**
```tsx
className="bg-[#1f2937] h-[49.472px] rounded-[14px]"
// Border: border-[#374151] border-[0.749px]
// Padding: pt-[16.74px] px-[16.74px] pb-[0.749px]

// Text (line 507):
className="text-[#9ca3af] text-[12px] leading-[16px]"
```

**Missing/Incorrect:**
1. Background: `bg-gray-900` → `bg-[#1f2937]`
2. Border color: `border-gray-800` → `border-[#374151]`
3. Border width: `border` → `border-[0.749px]`
4. Radius: `rounded-xl` → `rounded-[14px]` ≈ same
5. Text color: `text-gray-500` → `text-[#9ca3af]`

**Expected Behavior:**
```tsx
<div className="mt-6 bg-[#1f2937] border border-[#374151] rounded-[14px] p-3">
  <p className="text-[#9ca3af] text-xs text-center">
    Use bottom navigation to switch between modules quickly
  </p>
</div>
```

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 9: Header Title & Welcome Text

**Figma Screen:** HomeScreen > Heading & Paragraph  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx` (lines 48-49)  
**Status:** ⚠️ SIZING MISMATCH

**Current Implementation:**
```tsx
<h1 className="text-white text-xl font-bold mb-1">Din Collection</h1>
<p className="text-gray-400 text-sm">Welcome, Ahmed Ali</p>
```

**Figma Specification:**
```tsx
// Line 6: Heading 1
<p className="text-[#f9fafb] text-[20px] leading-[28px] font-['Arial:Bold']">
  Din Collection
</p>

// Line 14: Paragraph
<p className="text-[#9ca3af] text-[14px] leading-[20px]">
  Welcome, Ahmed Ali
</p>
```

**Missing/Incorrect:**
1. Title color: `text-white` → `text-[#f9fafb]` (very close, acceptable)
2. Title size: `text-xl` (20px) → `text-[20px]` ✓ (same)
3. Welcome color: `text-gray-400` → `text-[#9ca3af]` ✓ (same tailwind)
4. Welcome size: `text-sm` (14px) → `text-[14px]` ✓ (same)

**Expected Behavior:**
Current implementation is acceptable. Colors are Tailwind equivalents.

**Figma Status:** ✅ This change already exists in Figma (functionally equivalent)

---

### CHANGE 10: Branch Status Dot - Exact Color

**Figma Screen:** HomeScreen > Container (green dot)  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx` (line 51)  
**Status:** ⚠️ COLOR MISMATCH

**Current Implementation:**
```tsx
<div className="w-2 h-2 bg-green-500 rounded-full"></div>
```

**Figma Specification (line 20):**
```tsx
className="bg-[#10b981] rounded-[25139500px] size-[7.996px]"
```

**Missing/Incorrect:**
1. Background: `bg-green-500` → `bg-[#10b981]` (green-500 = #10b981, same!)
2. Size: `w-2 h-2` (8px) → `size-[7.996px]` ≈ `w-2 h-2` ✓

**Expected Behavior:**
Current implementation is correct. Tailwind green-500 matches Figma.

**Figma Status:** ✅ This change already exists in Figma (color match)

---

### CHANGE 11: Stats Card Text Colors

**Figma Screen:** HomeScreen > Stats cards  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx` (lines 63-68)  
**Status:** ⚠️ COLOR APPROXIMATIONS

**Current Implementation:**
```tsx
<p className="text-gray-400 text-xs">Today's Sales</p>
<p className="text-green-500 text-lg font-bold">Rs. 45,000</p>

<p className="text-gray-400 text-xs">Pending</p>
<p className="text-amber-500 text-lg font-bold">Rs. 12,000</p>
```

**Figma Specification:**
```tsx
// Line 104: Label
text-[#9ca3af] text-[12px] leading-[16px]

// Line 112: Today's Sales value
text-[#10b981] text-[18px] leading-[28px] font-bold

// Line 130: Pending label
text-[#9ca3af] text-[12px]

// Line 138: Pending value
text-[#f59e0b] text-[18px] leading-[28px] font-bold
```

**Missing/Incorrect:**
1. Label color: `text-gray-400` → `text-[#9ca3af]` ✓ (same)
2. Today's value: `text-green-500` → `text-[#10b981]` ✓ (same)
3. Today's size: `text-lg` (18px) → `text-[18px]` ✓ (same)
4. Pending value: `text-amber-500` → `text-[#f59e0b]` ✓ (same)

**Expected Behavior:**
Current implementation is correct. Tailwind colors match Figma.

**Figma Status:** ✅ This change already exists in Figma

---

### CHANGE 12: MODULES Section Header

**Figma Screen:** HomeScreen > Heading1  
**Component:** `/src/app/components/mobile/MobileDashboard.tsx` (line 75)  
**Status:** ⚠️ STYLING MISMATCH

**Current Implementation:**
```tsx
<h2 className="text-gray-400 text-sm font-medium uppercase mb-4 px-1">Modules</h2>
```

**Figma Specification (line 176):**
```tsx
<p className="text-[#9ca3af] text-[14px] leading-[20px]">MODULES</p>
```

**Missing/Incorrect:**
1. Color: `text-gray-400` → `text-[#9ca3af]` ✓ (same)
2. Size: `text-sm` (14px) → `text-[14px]` ✓ (same)
3. Weight: `font-medium` → Not specified in Figma (uses Arial:Regular)
4. Text: "Modules" → Should be "MODULES" (all caps in content, not CSS)

**Expected Behavior:**
```tsx
<h2 className="text-[#9ca3af] text-sm uppercase mb-4 px-1">MODULES</h2>
```
Note: Remove `font-medium`, text is already uppercase.

**Figma Status:** ✅ This change already exists in Figma

---

## ❌ OUT-OF-SCOPE ITEMS

The following items exist in CURRENT implementation but are **NOT in Figma** and must **NOT** be implemented or remain as extras (to be removed if strict Figma alignment required):

### 1. Products Module/Screen
**Status:** ❌ NOT IN FIGMA  
**Current:** `MobileProductsList.tsx` exists  
**Action:** Keep for now (business requirement) but acknowledge not in design spec

### 2. Settings Module Detail Screen
**Status:** ❌ NOT IN FIGMA  
**Current:** `MobileSettings.tsx` exists with detailed settings sections  
**Action:** Keep minimal version, no new settings UI

### 3. Sales Detail Screens
**Status:** ❌ NOT IN FIGMA  
**Current:** `MobileSalesList.tsx` has "Quick Stats" gradient card (correct)  
**Action:** Sales list cards need alignment (covered in changes below)

### 4. More Menu Sheet Content
**Status:** ✅ BUSINESS REQUIREMENT (not in Figma)  
**Current:** `BottomNav.tsx` has Sheet with all modules  
**Action:** Keep as is (needed for navigation)

### 5. Profile/Password Dialogs
**Status:** ❌ NOT IN FIGMA - DO NOT ADD  
**Action:** Do not implement any profile editing flows

### 6. Custom Header Menus
**Status:** ❌ NOT IN FIGMA - DO NOT ADD  
**Action:** Header menu button exists in Figma (line 84-89) but no menu content shown

### 7. Search Bars in Lists
**Status:** ⚠️ PARTIAL - NOT IN FIGMA DASHBOARD  
**Current:** Product/Sales lists have search  
**Action:** Keep in list screens, not on dashboard

---

## 🔄 ADDITIONAL SCREENS TO REVIEW

**Note:** Only HomeScreen and BottomNav are visible in Figma import. If other screens exist in Figma file, additional change requests needed:

### Screens Not Found in Import:
- Sales List detail view
- Products List detail view
- POS Screen
- Contacts List detail view
- Individual module screens

**Action Required:**
If these screens exist in Figma, they need separate change requests after review.

---

## 📊 SUMMARY

### Total Changes: 12
- ✅ **Figma Approved:** 12 changes (all from existing Figma)
- ⚠️ **Needs Figma Review:** 0 changes
- ❌ **Out of Scope:** 7 items identified

### Priority Levels:

**HIGH (Visual Impact):**
1. Change 1: Bottom Navigation styling
2. Change 5: Module cards border/background
3. Change 6: Module icon colors (exact hex)

**MEDIUM (Alignment):**
4. Change 3: Dashboard header colors
5. Change 4: Stats card styling
6. Change 8: Bottom hint card

**LOW (Minor Tweaks):**
7. Change 12: MODULES header font-weight
8. Other text/color adjustments (already very close)

---

## ✅ IMPLEMENTATION CHECKLIST

- [ ] Update BottomNav.tsx colors and sizing
- [ ] Update MobileDashboard.tsx header gradient colors
- [ ] Update stats cards border colors
- [ ] Update module cards backgrounds (#1f2937)
- [ ] Update module icon colors (exact hex values)
- [ ] Update hint card background
- [ ] Remove font-medium from MODULES header
- [ ] Verify all border widths (0.749px)
- [ ] Test on mobile device (actual sizing)
- [ ] Compare side-by-side with Figma

---

## 📝 NOTES

1. **Tailwind vs Exact Colors:** Most Tailwind colors (gray-400, green-500, etc.) match Figma exactly. Using hex values ensures 100% accuracy.

2. **Border Widths:** Figma uses `0.749px` borders. This is visually close to `1px` but can be set with `border-[0.749px]`.

3. **Sizing:** Figma provides precise pixel values. Use exact values for production.

4. **Fonts:** Figma specifies Arial. Current implementation uses system fonts (acceptable).

5. **Icons:** Figma uses custom SVG icons. Current implementation uses Lucide icons (acceptable substitution for similar shapes).

---

**STATUS:** Ready for implementation  
**APPROVED BY:** Design baseline (Figma)  
**NO NEW FEATURES ADDED**
