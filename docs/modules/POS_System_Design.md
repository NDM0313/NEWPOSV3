# POS System Design Architecture (Strict Dark Mode)

> **Status:** Active "Source of Truth"
> **Theme:** Modern High-End Dark ERP
> **Framework:** React + Tailwind CSS v4
> **Icons:** Lucide-React

## 1. Global Design Tokens

### **Color Palette (Strict)**
- **Background Main:** `#111827` (gray-900) - Used for the main canvas.
- **Background Panel:** `#0B1019` (gray-950) - Used for sidebars, inputs, and deep contrast areas.
- **Borders:** `border-gray-800` (opacity 100% or 50% depending on context).
- **Text Primary:** `text-white` or `text-gray-200`.
- **Text Secondary:** `text-gray-400` or `text-gray-500`.

### **Mode Specific Accents**
Dynamic colors based on `posMode` state:
- **Retail (Default):** `blue-600` (Primary), `shadow-blue-900/20`.
- **Wholesale:** `purple-600` (Primary), `shadow-purple-900/20`.
- **Returns:** `orange-600` (Primary), `shadow-orange-900/20`.

### **Typography & Shapes**
- **Font:** Inter (Sans-Serif).
- **Card Radius:** `rounded-xl` (12px).
- **Input/Button Radius:** `rounded-lg` (8px) or `rounded-xl` (for larger inputs).
- **Icon Sizes:**
  - Small/Action: `14px` or `16px`.
  - Standard/Nav: `20px`.
  - Large/Empty States: `32px` or `48px`.

---

## 2. Layout Structure (Split Screen)

The POS is a **Full Screen, Non-Scrolling Body** application (`h-full overflow-hidden`).

### **Grid System**
- **Mobile:** Single Column (`flex-col`).
- **Desktop:** 12-Column Grid (`grid-cols-12`).
  - **Left Panel (Catalog):** `col-span-8` (66% width).
  - **Right Panel (Cart):** `col-span-4` (33% width).

---

## 3. Component Blueprints

### **A. Top Navigation Bar**
- **Height:** `h-16` (Fixed).
- **Background:** `#0B1019`.
- **Border:** Bottom `border-gray-800`.
- **Shadow:** `shadow-md`.
- **Key Element: Segmented Control (Mode Switcher)**
  - **Container:** `#111827`, `border-gray-800`, `rounded-lg`, `p-1`.
  - **Buttons:** `px-4 py-1.5`, `text-sm font-medium`.
  - **Active State:** Solid color (`bg-blue-600`), White text, Shadow.
  - **Inactive State:** Text gray-400, Hover white.
  - **Dividers:** `w-px h-4 bg-gray-800` between buttons.

### **B. Left Panel: Product Catalog**
- **Toolbar Area:**
  - **Search Input:** `h-12`, `bg-[#0B1019]`, `border-gray-800`, `rounded-xl`, `pl-12` (Icon Left), `text-base`.
  - **Category Pills:** Horizontal Scroll, `rounded-full`, `border-gray-800`, Active `bg-white text-black`.
- **Product Grid:**
  - **Gap:** `gap-4`.
  - **Card Style:** `#111827` bg, `border-gray-800`, `hover:border-blue-500/50`.
  - **Image Area:** `aspect-[4/3]`, `bg-gray-900`.
  - **Stock Badge:** Absolute top-right, `bg-black/50 backdrop-blur`.
  - **Add Button:** Hidden by default, appears on `group-hover`.

### **C. Right Panel: Cart & Checkout**
- **Background:** `#0B1019` (Darker than main).
- **Border:** Left `border-gray-800`.
- **Elevation:** `shadow-2xl` z-index 10.
- **Customer Section:**
  - **Selector:** `h-11`, `justify-between`, `bg-[#111827]`.
  - **Info Grid:** 2-col grid for Date/Order ID, `text-[10px] uppercase labels`.
- **Cart Items (Scrollable Area):**
  - **Item Card:** `#111827`, `p-3`, `rounded-xl`, `border-gray-800/50`.
  - **Remove Action:** Red button absolute top-right `-top-2 -right-2`, shows on hover.
  - **Qty Control:** Minimalist `bg-[#0B1019]` toggle with `+` / `-` buttons.
- **Footer (Sticky):**
  - **Shadow:** `shadow-[0_-10px_40px_rgba(0,0,0,0.5)]` (Deep shadow for floating effect).
  - **Pay Button:** `h-12`, `w-full`, `font-bold`, `text-base`.

---

## 4. Exact Tailwind Implementation Guide

### **Icon Imports**
Use `lucide-react`:
```typescript
import { 
  ShoppingBag, Truck, RotateCcw, // Modes
  Search, ScanBarcode, Package, // Catalog
  User, ChevronsUpDown, Check, // Customer
  Plus, Minus, X, Trash2, // Actions
  CreditCard, Banknote, Tag // Payment
} from 'lucide-react';
```

### **Shadows & Glows**
- **Blue Glow:** `shadow-lg shadow-blue-900/20`
- **Purple Glow:** `shadow-lg shadow-purple-900/20`
- **Orange Glow:** `shadow-lg shadow-orange-900/20`

---

## 5. Cursor AI Prompt (Copy/Paste)

**Use this prompt to generate/restore this design:**

```text
Build a high-end POS Transaction Component in React/Tailwind.
Strict Dark Mode Theme: Main BG #111827, Panel BG #0B1019, Borders border-gray-800.

Structure:
1. Top Bar (h-16): Contains a Segmented Control (Retail/Wholesale/Return) with active state highlighting (Blue/Purple/Orange).
2. Split Screen Grid (grid-cols-12):
   - Left (col-span-8): Product Catalog.
     - Large h-12 Search Input with icon.
     - Scrollable Category Pills (Rounded-full).
     - Grid of Product Cards (Aspect 4/3 image placeholder, hover effects, stock badges).
   - Right (col-span-4): Cart Panel (Background #0B1019).
     - Customer Popover Selector (h-11).
     - Scrollable Cart Items List (Card style, remove button on hover).
     - Sticky Bottom Footer with Totals and massive "Pay Now" button.
     - Footer must have `shadow-[0_-10px_40px_rgba(0,0,0,0.5)]`.

Fonts: Inter.
Icons: Lucide-React (16px/20px).
Logic: Add/Remove items, update quantity, calculate tax/totals.
```
