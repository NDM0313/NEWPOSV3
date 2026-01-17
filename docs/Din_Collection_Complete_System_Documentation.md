# Din Collection - Complete ERP System Documentation 📚

**Bridal Rental Management ERP - Complete A to Z Guide**

**Dark Mode Theme: `#111827` (Gray-900)**

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Design System](#design-system)
4. [Data Models](#data-models)
5. [Navigation & Layout](#navigation--layout)
6. [Branch Management Module](#branch-management-module)
7. [Salesmen Management Module](#salesmen-management-module)
8. [Inventory Management Module](#inventory-management-module)
9. [Sales Module](#sales-module)
10. [Purchase Module](#purchase-module)
11. [Accounting Module](#accounting-module)
12. [Expenses Module](#expenses-module)
13. [Rental Management Module](#rental-management-module)
14. [POS (Point of Sale) Module](#pos-module)
15. [Settings Module](#settings-module)
16. [State Management](#state-management)
17. [Workflows & Business Logic](#workflows--business-logic)
18. [UI Components Library](#ui-components-library)

---

## 1. System Overview

### **Purpose**
Complete Bridal Rental Management ERP system for "Din Collection" managing:
- Multi-branch operations
- Sales team performance
- Product inventory
- Sales & Purchase transactions
- Financial accounting
- Expense tracking
- Rental bookings
- Point of Sale
- System configuration

### **Key Features**
- ✅ **Strict Dark Mode** - Complete `#111827` gray-900 theme
- ✅ **Modular Architecture** - Independent modules for each business function
- ✅ **Responsive Design** - Desktop & mobile optimized
- ✅ **Real-time Updates** - Instant state management
- ✅ **Professional UI** - Modern, clean, color-coded interface
- ✅ **Complete Traceability** - Full transaction tracking
- ✅ **Multi-status Workflows** - Draft → Quotation → Order → Final
- ✅ **Comprehensive Settings** - 127+ configurable options across 12 categories

### **Business Model**
- **Primary:** Bridal dress rental service
- **Secondary:** Fabric wholesale & retail
- **Tertiary:** Custom stitching services

---

## 2. Architecture & Technology Stack

### **Frontend**
```
React + TypeScript + Tailwind CSS v4.0
├── Vite (Build Tool)
├── React Router (Navigation)
├── Lucide React (Icons)
├── Shadcn/ui (Base Components)
├── Recharts (Charts & Analytics)
├── Sonner (Toast Notifications)
└── Motion/React (Animations)
```

### **State Management**
```
React Hooks + Context API
├── useState (Local component state)
├── useEffect (Side effects)
├── useRef (DOM references)
└── Mock Data (Simulated backend)
```

### **File Structure**
```
/src
├── /app
│   ├── App.tsx                      # Main entry component
│   └── /components                  # All feature components
│       ├── /sales                   # Sales module
│       │   ├── SalesTable.tsx
│       │   ├── SaleForm.tsx
│       │   └── SalesMetrics.tsx
│       ├── /purchases               # Purchase module
│       │   ├── PurchasesTable.tsx
│       │   └── PurchaseForm.tsx
│       ├── /inventory               # Inventory module
│       │   ├── ProductsTable.tsx
│       │   ├── ProductForm.tsx
│       │   └── StockAlerts.tsx
│       ├── /rental                  # Rental module
│       │   ├── RentalsTable.tsx
│       │   ├── RentalForm.tsx
│       │   └── RentalCalendar.tsx
│       ├── /accounting              # Accounting module
│       │   ├── AccountsTable.tsx
│       │   ├── TransactionForm.tsx
│       │   └── FinancialReports.tsx
│       ├── /expenses                # Expenses module
│       │   ├── ExpensesTable.tsx
│       │   └── ExpenseForm.tsx
│       ├── /pos                     # POS module
│       │   └── POSInterface.tsx
│       ├── /settings                # Settings module
│       │   ├── SettingsModule.tsx
│       │   └── /categories
│       ├── /branches                # Branch module
│       │   ├── BranchesTable.tsx
│       │   └── BranchForm.tsx
│       ├── /salesmen                # Salesmen module
│       │   ├── SalesmenTable.tsx
│       │   └── SalesmanForm.tsx
│       └── /ui                      # Reusable UI components
│           ├── button.tsx
│           ├── input.tsx
│           ├── select.tsx
│           ├── table.tsx
│           ├── dialog.tsx
│           └── badge.tsx
├── /styles
│   ├── theme.css                    # Tailwind v4 theme
│   └── fonts.css                    # Font imports
└── /imports                         # Assets (images, SVGs)
```

---

## 3. Design System

### **Color Palette**

#### **Background Colors**
```css
--bg-primary: #111827      /* Main background (gray-900) */
--bg-secondary: #1f2937    /* Cards background (gray-800) */
--bg-tertiary: #0f172a     /* Elevated sections (gray-950) */
--bg-hover: #374151        /* Hover states (gray-700) */
```

#### **Border Colors**
```css
--border-primary: #374151   /* Main borders (gray-700) */
--border-secondary: #4b5563 /* Secondary borders (gray-600) */
--border-accent: #1f2937    /* Accent borders (gray-800) */
```

#### **Text Colors**
```css
--text-primary: #ffffff     /* Primary text */
--text-secondary: #9ca3af   /* Secondary text (gray-400) */
--text-muted: #6b7280       /* Muted text (gray-500) */
--text-disabled: #4b5563    /* Disabled text (gray-600) */
```

#### **Accent Colors (Module-Specific)**
```css
--accent-sales: #10b981     /* Green-500 - Sales module */
--accent-purchase: #3b82f6  /* Blue-500 - Purchase module */
--accent-rental: #8b5cf6    /* Purple-500 - Rental module */
--accent-accounting: #f59e0b /* Amber-500 - Accounting module */
--accent-expenses: #ef4444   /* Red-500 - Expenses module */
--accent-inventory: #06b6d4  /* Cyan-500 - Inventory module */
--accent-pos: #ec4899        /* Pink-500 - POS module */
--accent-settings: #6366f1   /* Indigo-500 - Settings module */
```

### **Typography**

```css
/* Headers */
.heading-1 { font-size: 24px; font-weight: 700; }
.heading-2 { font-size: 20px; font-weight: 600; }
.heading-3 { font-size: 18px; font-weight: 600; }
.heading-4 { font-size: 16px; font-weight: 600; }

/* Body */
.body-large { font-size: 16px; font-weight: 400; }
.body-normal { font-size: 14px; font-weight: 400; }
.body-small { font-size: 12px; font-weight: 400; }
.body-xs { font-size: 10px; font-weight: 400; }

/* Labels */
.label { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

/* Mono (SKU, Numbers) */
.mono { font-family: 'Monaco', 'Courier New', monospace; }
```

### **Spacing System**
```
xs:  4px   (spacing-1)
sm:  8px   (spacing-2)
md:  12px  (spacing-3)
lg:  16px  (spacing-4)
xl:  24px  (spacing-6)
2xl: 32px  (spacing-8)
3xl: 48px  (spacing-12)
```

### **Border Radius**
```
sm: 4px    (rounded-sm)
md: 8px    (rounded-md)
lg: 12px   (rounded-lg)
xl: 16px   (rounded-xl)
2xl: 24px  (rounded-2xl)
full: 9999px (rounded-full)
```

### **Shadows**
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
```

---

## 4. Data Models

### **4.1 Branch Model**

```typescript
interface Branch {
    id: number;
    name: string;
    code: string;          // e.g., "BR-001"
    location: string;
    phone: string;
    email: string;
    manager: string;
    status: 'active' | 'inactive';
    type: 'main' | 'sub';
    openingDate: string;   // ISO date
    address: string;
    city: string;
    state: string;
    zipCode: string;
    salesTarget: number;   // Monthly target
    currentSales: number;  // Current month sales
    employeeCount: number;
    createdAt: string;
}
```

**Example:**
```json
{
    "id": 1,
    "name": "Main Branch - Karachi",
    "code": "BR-001",
    "location": "Gulshan-e-Iqbal, Karachi",
    "phone": "+92-321-1234567",
    "email": "karachi@dincollection.com",
    "manager": "Ahmed Ali",
    "status": "active",
    "type": "main",
    "openingDate": "2020-01-15",
    "address": "Block 13-D, Main University Road",
    "city": "Karachi",
    "state": "Sindh",
    "zipCode": "75300",
    "salesTarget": 500000,
    "currentSales": 380000,
    "employeeCount": 12,
    "createdAt": "2020-01-15T09:00:00Z"
}
```

---

### **4.2 Salesman Model**

```typescript
interface Salesman {
    id: number;
    name: string;
    code: string;           // e.g., "SM-001"
    email: string;
    phone: string;
    cnic: string;           // National ID
    address: string;
    branchId: number;
    branchName: string;
    joiningDate: string;
    salary: number;
    commissionRate: number; // Percentage
    status: 'active' | 'inactive' | 'on-leave';
    photo?: string;
    
    // Performance Metrics
    totalSales: number;     // All-time
    monthlySales: number;   // Current month
    totalCommission: number;
    monthlyTarget: number;
    achievementRate: number; // Percentage
    
    // Additional Info
    bankAccount?: string;
    emergencyContact?: string;
    notes?: string;
    createdAt: string;
}
```

**Example:**
```json
{
    "id": 1,
    "name": "Ali Hassan",
    "code": "SM-001",
    "email": "ali.hassan@dincollection.com",
    "phone": "+92-321-9876543",
    "cnic": "42101-1234567-8",
    "address": "Block 5, Gulshan-e-Iqbal, Karachi",
    "branchId": 1,
    "branchName": "Main Branch - Karachi",
    "joiningDate": "2021-03-10",
    "salary": 35000,
    "commissionRate": 2.5,
    "status": "active",
    "totalSales": 2850000,
    "monthlySales": 185000,
    "totalCommission": 71250,
    "monthlyTarget": 200000,
    "achievementRate": 92.5,
    "bankAccount": "PK12HABB0012345678901234",
    "emergencyContact": "+92-300-1234567",
    "createdAt": "2021-03-10T10:00:00Z"
}
```

---

### **4.3 Product Model**

```typescript
interface Product {
    id: number;
    name: string;
    sku: string;            // e.g., "PRD-001"
    category: string;       // "Bridal", "Fabric", "Accessories"
    subcategory?: string;
    description?: string;
    
    // Pricing
    costPrice: number;      // Purchase price
    salePrice: number;      // Retail price
    wholesalePrice?: number;
    rentalPrice?: number;   // Daily rental rate
    
    // Stock Management
    stock: number;
    minStockLevel: number;  // Alert threshold
    maxStockLevel: number;
    reorderPoint: number;
    
    // Attributes
    brand?: string;
    color?: string;
    size?: string;
    material?: string;
    weight?: number;
    dimensions?: string;
    
    // Status & Flags
    status: 'active' | 'inactive' | 'discontinued';
    isRental: boolean;      // Available for rent
    hasVariations: boolean; // Size/Color variations
    needsPacking: boolean;  // Requires packing details (thaans/meters)
    
    // Images
    images?: string[];
    thumbnail?: string;
    
    // Supplier Info
    supplierId?: number;
    supplierName?: string;
    supplierSKU?: string;
    
    // Dates
    createdAt: string;
    updatedAt: string;
    lastPurchaseDate?: string;
    lastSaleDate?: string;
}
```

**Example - Bridal Dress:**
```json
{
    "id": 1,
    "name": "Bridal Lehenga - Red Velvet",
    "sku": "BRD-001",
    "category": "Bridal",
    "subcategory": "Lehenga",
    "description": "Premium red velvet bridal lehenga with heavy embroidery",
    "costPrice": 45000,
    "salePrice": 85000,
    "rentalPrice": 8500,
    "stock": 3,
    "minStockLevel": 1,
    "maxStockLevel": 5,
    "reorderPoint": 2,
    "brand": "Din Collection Signature",
    "color": "Red",
    "size": "M",
    "material": "Velvet with Zari Work",
    "status": "active",
    "isRental": true,
    "hasVariations": true,
    "needsPacking": false,
    "images": ["bridal-001-1.jpg", "bridal-001-2.jpg"],
    "thumbnail": "bridal-001-thumb.jpg",
    "createdAt": "2023-01-15T10:00:00Z"
}
```

**Example - Fabric (Wholesale):**
```json
{
    "id": 50,
    "name": "Premium Cotton Lawn - White",
    "sku": "FAB-050",
    "category": "Fabric",
    "subcategory": "Cotton",
    "description": "High-quality cotton lawn fabric, perfect for summer wear",
    "costPrice": 600,
    "salePrice": 850,
    "wholesalePrice": 750,
    "stock": 250,
    "minStockLevel": 50,
    "maxStockLevel": 500,
    "reorderPoint": 75,
    "color": "White",
    "material": "100% Cotton",
    "weight": 85,
    "status": "active",
    "isRental": false,
    "hasVariations": false,
    "needsPacking": true,
    "supplierId": 5,
    "supplierName": "Textile Mills Ltd",
    "createdAt": "2023-06-20T14:00:00Z"
}
```

---

### **4.4 Sale Model**

```typescript
interface Sale {
    id: number;
    saleNumber: string;      // e.g., "SAL-2024-001"
    invoiceNumber: string;   // e.g., "INV-001"
    refNumber?: string;      // e.g., "SO-001"
    
    // Status Workflow
    status: 'draft' | 'quotation' | 'order' | 'final';
    
    // Customer Info
    customerId?: number;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddress?: string;
    
    // Transaction Details
    saleDate: string;        // ISO date
    dueDate?: string;
    
    // Items
    items: SaleItem[];
    
    // Pricing
    subtotal: number;
    discount: number;
    discountType: 'percentage' | 'fixed';
    taxAmount: number;
    shippingCharges: number;
    extraExpenses: Expense[];
    totalAmount: number;
    
    // Payment
    paymentStatus: 'paid' | 'partial' | 'credit';
    paidAmount: number;
    balanceDue: number;
    paymentMethod?: 'cash' | 'card' | 'bank' | 'cheque';
    partialPayments: PartialPayment[];
    
    // Salesman & Branch
    salesmanId: number;
    salesmanName: string;
    salesmanCommission: number;
    branchId: number;
    branchName: string;
    
    // Sale Type
    saleType: 'retail' | 'wholesale' | 'studio';
    
    // Shipping
    shippingEnabled: boolean;
    shippingAddress?: string;
    trackingNumber?: string;
    
    // Notes
    notes?: string;
    internalNotes?: string;
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

interface SaleItem {
    id: number;
    productId: number;
    name: string;
    sku: string;
    price: number;
    qty: number;
    
    // Standard Variation Fields
    size?: string;
    color?: string;
    
    // Standard Packing Fields (Wholesale)
    thaans?: number;        // Number of bundles
    meters?: number;        // Total meters
    
    // Legacy packing (still supported)
    packingDetails?: PackingDetails;
}

interface PartialPayment {
    id: number;
    amount: number;
    date: string;
    method: 'cash' | 'card' | 'bank' | 'cheque';
    reference?: string;
    notes?: string;
}

interface Expense {
    id: number;
    type: string;
    description: string;
    amount: number;
}
```

**Example Sale:**
```json
{
    "id": 1,
    "saleNumber": "SAL-2024-001",
    "invoiceNumber": "INV-001",
    "refNumber": "SO-001",
    "status": "final",
    "customerId": 45,
    "customerName": "Ayesha Khan",
    "customerPhone": "+92-300-1234567",
    "customerEmail": "ayesha.khan@email.com",
    "saleDate": "2024-01-15T10:30:00Z",
    "dueDate": "2024-02-15T10:30:00Z",
    "items": [
        {
            "id": 1,
            "productId": 1,
            "name": "Bridal Lehenga - Red Velvet",
            "sku": "BRD-001",
            "price": 85000,
            "qty": 1,
            "size": "M",
            "color": "Red"
        },
        {
            "id": 2,
            "productId": 50,
            "name": "Premium Cotton Lawn",
            "sku": "FAB-050",
            "price": 850,
            "qty": 1,
            "thaans": 3,
            "meters": 45
        }
    ],
    "subtotal": 85850,
    "discount": 5000,
    "discountType": "fixed",
    "taxAmount": 0,
    "shippingCharges": 500,
    "extraExpenses": [],
    "totalAmount": 81350,
    "paymentStatus": "partial",
    "paidAmount": 50000,
    "balanceDue": 31350,
    "paymentMethod": "cash",
    "partialPayments": [
        {
            "id": 1,
            "amount": 50000,
            "date": "2024-01-15T10:30:00Z",
            "method": "cash",
            "notes": "Advance payment"
        }
    ],
    "salesmanId": 1,
    "salesmanName": "Ali Hassan",
    "salesmanCommission": 2147.5,
    "branchId": 1,
    "branchName": "Main Branch - Karachi",
    "saleType": "retail",
    "shippingEnabled": true,
    "shippingAddress": "House 123, Block 15, Gulshan-e-Iqbal, Karachi",
    "notes": "Customer requested delivery before wedding date",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:00:00Z",
    "completedAt": "2024-01-15T11:00:00Z"
}
```

---

### **4.5 Purchase Model**

```typescript
interface Purchase {
    id: number;
    purchaseNumber: string;  // e.g., "PUR-2024-001"
    billNumber?: string;
    refNumber?: string;
    
    // Status
    status: 'draft' | 'ordered' | 'received' | 'final';
    
    // Supplier Info
    supplierId: number;
    supplierName: string;
    supplierPhone?: string;
    supplierEmail?: string;
    supplierAddress?: string;
    
    // Transaction Details
    purchaseDate: string;
    expectedDate?: string;   // Expected delivery
    receivedDate?: string;   // Actual delivery
    
    // Items
    items: PurchaseItem[];
    
    // Pricing
    subtotal: number;
    discount: number;
    discountType: 'percentage' | 'fixed';
    taxAmount: number;
    shippingCharges: number;
    totalAmount: number;
    
    // Payment
    paymentStatus: 'paid' | 'partial' | 'credit';
    paidAmount: number;
    balanceDue: number;
    paymentMethod?: 'cash' | 'card' | 'bank' | 'cheque';
    partialPayments: PartialPayment[];
    
    // Branch
    branchId: number;
    branchName: string;
    
    // Notes
    notes?: string;
    internalNotes?: string;
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

interface PurchaseItem {
    id: number;
    productId: number;
    name: string;
    sku: string;
    price: number;      // Cost price
    qty: number;
    
    // Variation
    size?: string;
    color?: string;
    
    // Packing
    thaans?: number;
    meters?: number;
}
```

---

### **4.6 Rental Model**

```typescript
interface Rental {
    id: number;
    rentalNumber: string;    // e.g., "RNT-2024-001"
    
    // Status Workflow
    status: 'booked' | 'confirmed' | 'ongoing' | 'returned' | 'cancelled';
    
    // Customer Info
    customerId: number;
    customerName: string;
    customerPhone: string;
    customerCNIC: string;    // Required for rentals
    customerAddress: string;
    
    // Rental Period
    bookingDate: string;
    rentalStartDate: string;
    rentalEndDate: string;
    returnDate?: string;     // Actual return date
    duration: number;        // Days
    
    // Items
    items: RentalItem[];
    
    // Pricing
    rentalAmount: number;
    securityDeposit: number;
    totalAmount: number;
    
    // Payment
    paymentStatus: 'paid' | 'partial' | 'pending';
    paidAmount: number;
    balanceDue: number;
    partialPayments: PartialPayment[];
    
    // Return Status
    damageCharges: number;
    lateCharges: number;
    refundAmount: number;
    
    // Additional Info
    eventType: 'wedding' | 'party' | 'photoshoot' | 'other';
    eventDate: string;
    deliveryRequired: boolean;
    deliveryAddress?: string;
    
    // Branch & Salesman
    branchId: number;
    branchName: string;
    salesmanId: number;
    salesmanName: string;
    
    // Notes
    notes?: string;
    specialInstructions?: string;
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
}

interface RentalItem {
    id: number;
    productId: number;
    name: string;
    sku: string;
    dailyRate: number;
    duration: number;
    totalAmount: number;
    
    // Condition tracking
    conditionOut: 'excellent' | 'good' | 'fair';
    conditionIn?: 'excellent' | 'good' | 'fair' | 'damaged';
    damageNotes?: string;
}
```

**Example Rental:**
```json
{
    "id": 1,
    "rentalNumber": "RNT-2024-001",
    "status": "confirmed",
    "customerId": 78,
    "customerName": "Fatima Ahmed",
    "customerPhone": "+92-321-7654321",
    "customerCNIC": "42101-9876543-2",
    "customerAddress": "House 456, DHA Phase 5, Karachi",
    "bookingDate": "2024-01-10T14:00:00Z",
    "rentalStartDate": "2024-02-14T10:00:00Z",
    "rentalEndDate": "2024-02-17T18:00:00Z",
    "duration": 3,
    "items": [
        {
            "id": 1,
            "productId": 1,
            "name": "Bridal Lehenga - Red Velvet",
            "sku": "BRD-001",
            "dailyRate": 8500,
            "duration": 3,
            "totalAmount": 25500,
            "conditionOut": "excellent"
        }
    ],
    "rentalAmount": 25500,
    "securityDeposit": 20000,
    "totalAmount": 45500,
    "paymentStatus": "paid",
    "paidAmount": 45500,
    "balanceDue": 0,
    "partialPayments": [
        {
            "id": 1,
            "amount": 45500,
            "date": "2024-01-10T14:00:00Z",
            "method": "bank",
            "reference": "TRX-123456789"
        }
    ],
    "damageCharges": 0,
    "lateCharges": 0,
    "refundAmount": 0,
    "eventType": "wedding",
    "eventDate": "2024-02-15T18:00:00Z",
    "deliveryRequired": true,
    "deliveryAddress": "Pearl Continental Hotel, Karachi",
    "branchId": 1,
    "branchName": "Main Branch - Karachi",
    "salesmanId": 1,
    "salesmanName": "Ali Hassan",
    "notes": "Customer needs fitting appointment on 12th Feb",
    "specialInstructions": "Handle with extra care, VIP customer",
    "createdAt": "2024-01-10T14:00:00Z",
    "updatedAt": "2024-01-10T14:30:00Z"
}
```

---

### **4.7 Accounting Models**

#### **Account Model**
```typescript
interface Account {
    id: number;
    accountNumber: string;   // e.g., "ACC-1001"
    accountName: string;
    accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    category: string;        // e.g., "Cash", "Bank", "Accounts Receivable"
    balance: number;
    currency: string;        // Default: "PKR"
    status: 'active' | 'inactive';
    parentAccountId?: number;
    description?: string;
    createdAt: string;
}
```

#### **Transaction Model**
```typescript
interface Transaction {
    id: number;
    transactionNumber: string; // e.g., "TRX-2024-001"
    date: string;
    type: 'debit' | 'credit';
    
    // Accounts
    fromAccountId: number;
    fromAccountName: string;
    toAccountId: number;
    toAccountName: string;
    
    // Amount
    amount: number;
    
    // Reference
    referenceType?: 'sale' | 'purchase' | 'expense' | 'rental' | 'other';
    referenceId?: number;
    referenceNumber?: string;
    
    // Details
    description: string;
    notes?: string;
    
    // Branch & User
    branchId: number;
    branchName: string;
    enteredBy: string;
    
    // Status
    status: 'pending' | 'completed' | 'cancelled';
    
    createdAt: string;
}
```

**Example Accounts:**
```json
[
    {
        "id": 1,
        "accountNumber": "ACC-1001",
        "accountName": "Cash in Hand",
        "accountType": "asset",
        "category": "Cash",
        "balance": 125000,
        "currency": "PKR",
        "status": "active"
    },
    {
        "id": 2,
        "accountNumber": "ACC-1002",
        "accountName": "Allied Bank - Current Account",
        "accountType": "asset",
        "category": "Bank",
        "balance": 850000,
        "currency": "PKR",
        "status": "active"
    },
    {
        "id": 3,
        "accountNumber": "ACC-2001",
        "accountName": "Accounts Payable",
        "accountType": "liability",
        "category": "Payables",
        "balance": 250000,
        "currency": "PKR",
        "status": "active"
    },
    {
        "id": 4,
        "accountNumber": "ACC-4001",
        "accountName": "Sales Revenue",
        "accountType": "revenue",
        "category": "Sales",
        "balance": 2850000,
        "currency": "PKR",
        "status": "active"
    }
]
```

---

### **4.8 Expense Model**

```typescript
interface Expense {
    id: number;
    expenseNumber: string;   // e.g., "EXP-2024-001"
    date: string;
    
    // Category
    category: string;        // "Rent", "Salary", "Utilities", "Marketing", etc.
    subcategory?: string;
    
    // Details
    title: string;
    description?: string;
    amount: number;
    
    // Payment
    paymentMethod: 'cash' | 'card' | 'bank' | 'cheque';
    paymentStatus: 'paid' | 'pending';
    paidTo: string;          // Recipient name
    
    // Receipt
    receiptNumber?: string;
    attachments?: string[];
    
    // Branch & Approval
    branchId: number;
    branchName: string;
    approvedBy?: string;
    approvalStatus: 'pending' | 'approved' | 'rejected';
    
    // Accounting Link
    accountId?: number;
    accountName?: string;
    
    // Notes
    notes?: string;
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
}
```

**Example Expenses:**
```json
[
    {
        "id": 1,
        "expenseNumber": "EXP-2024-001",
        "date": "2024-01-05T00:00:00Z",
        "category": "Rent",
        "title": "Monthly Rent - January 2024",
        "description": "Showroom rent for Main Branch",
        "amount": 85000,
        "paymentMethod": "bank",
        "paymentStatus": "paid",
        "paidTo": "Landlord - Mr. Shahid",
        "receiptNumber": "REC-001",
        "branchId": 1,
        "branchName": "Main Branch - Karachi",
        "approvedBy": "Ahmed Ali",
        "approvalStatus": "approved",
        "accountId": 5,
        "accountName": "Rent Expense",
        "createdAt": "2024-01-05T10:00:00Z"
    },
    {
        "id": 2,
        "expenseNumber": "EXP-2024-002",
        "date": "2024-01-10T00:00:00Z",
        "category": "Utilities",
        "subcategory": "Electricity",
        "title": "Electricity Bill - December 2023",
        "amount": 12500,
        "paymentMethod": "cash",
        "paymentStatus": "paid",
        "paidTo": "K-Electric",
        "receiptNumber": "KE-123456",
        "branchId": 1,
        "branchName": "Main Branch - Karachi",
        "approvalStatus": "approved",
        "createdAt": "2024-01-10T15:30:00Z"
    }
]
```

---

### **4.9 Settings Model**

```typescript
interface SettingsCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
    settings: Setting[];
}

interface Setting {
    id: string;
    name: string;
    type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'date';
    value: any;
    options?: string[];      // For select type
    description?: string;
    unit?: string;           // For number type (e.g., "days", "PKR", "%")
    min?: number;
    max?: number;
    required?: boolean;
}
```

**Settings Categories:**
1. **General** (20 settings)
2. **Billing & Invoicing** (15 settings)
3. **Inventory** (12 settings)
4. **Rental** (18 settings)
5. **Sales & Commission** (10 settings)
6. **Payment & Finance** (14 settings)
7. **Notifications** (16 settings)
8. **Packing & Shipping** (8 settings)
9. **Tax & Compliance** (6 settings)
10. **Backup & Security** (5 settings)
11. **Appearance** (8 settings)
12. **Advanced** (5 settings)

**Total: 127 Settings**

---

## 5. Navigation & Layout

### **5.1 Main Navigation Structure**

```typescript
const navigationItems = [
    {
        section: "Dashboard",
        items: [
            { name: "Overview", path: "/", icon: "LayoutDashboard" }
        ]
    },
    {
        section: "Operations",
        items: [
            { name: "Sales", path: "/sales", icon: "ShoppingCart", color: "green" },
            { name: "Purchases", path: "/purchases", icon: "ShoppingBag", color: "blue" },
            { name: "Rentals", path: "/rentals", icon: "Calendar", color: "purple" },
            { name: "POS", path: "/pos", icon: "CreditCard", color: "pink" }
        ]
    },
    {
        section: "Inventory",
        items: [
            { name: "Products", path: "/products", icon: "Package", color: "cyan" },
            { name: "Stock Alerts", path: "/stock-alerts", icon: "AlertTriangle", color: "orange" }
        ]
    },
    {
        section: "Finance",
        items: [
            { name: "Accounting", path: "/accounting", icon: "Calculator", color: "amber" },
            { name: "Expenses", path: "/expenses", icon: "Receipt", color: "red" }
        ]
    },
    {
        section: "Management",
        items: [
            { name: "Branches", path: "/branches", icon: "Building2", color: "indigo" },
            { name: "Salesmen", path: "/salesmen", icon: "Users", color: "green" }
        ]
    },
    {
        section: "System",
        items: [
            { name: "Settings", path: "/settings", icon: "Settings", color: "gray" }
        ]
    }
];
```

### **5.2 Layout Structure**

```tsx
<div className="flex h-screen bg-gray-900">
    {/* Sidebar - Left Navigation */}
    <aside className="w-64 bg-gray-950 border-r border-gray-800">
        <div className="p-4">
            {/* Logo */}
            <h1 className="text-xl font-bold text-white">Din Collection</h1>
        </div>
        
        {/* Navigation Menu */}
        <nav className="mt-4">
            {/* Navigation items grouped by section */}
        </nav>
    </aside>
    
    {/* Main Content Area */}
    <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
            {/* Page title, search, notifications */}
        </header>
        
        {/* Content */}
        <div className="p-6">
            {/* Dynamic content based on route */}
        </div>
    </main>
</div>
```

---

## 6. Branch Management Module

### **6.1 Overview**
Complete branch management system for multi-location operations.

### **6.2 Features**
- ✅ Add/Edit/Delete branches
- ✅ Branch status management (Active/Inactive)
- ✅ Branch type (Main/Sub)
- ✅ Sales target tracking
- ✅ Employee count
- ✅ Performance metrics
- ✅ Contact information management

### **6.3 Components**

#### **BranchesTable.tsx**
Main table displaying all branches with:
- Branch code, name, location
- Manager information
- Status badges
- Sales performance (current vs target)
- Employee count
- Action buttons (Edit, Delete)

**Columns:**
```
┌──────┬─────────────────┬─────────────┬──────────┬────────────────┬───────────┬─────────┐
│ Code │ Branch Name     │ Location    │ Manager  │ Sales Progress │ Employees │ Actions │
├──────┼─────────────────┼─────────────┼──────────┼────────────────┼───────────┼─────────┤
│BR-001│ Main - Karachi  │ Gulshan     │ Ahmed    │ 380K / 500K    │    12     │ [Edit]  │
│      │                 │             │          │ ████████░░ 76% │           │ [Delete]│
└──────┴─────────────────┴─────────────┴──────────┴────────────────┴───────────┴─────────┘
```

**Status Badge Colors:**
- 🟢 Active: Green
- 🔴 Inactive: Red

**Visual Features:**
- Search & filter by branch name, code, location
- Sort by any column
- Pagination (10/25/50 per page)
- Export to CSV/Excel
- Responsive mobile view

#### **BranchForm.tsx**
Modal form for creating/editing branches.

**Fields:**
```
┌────────────────────────────────────────────┐
│ Add/Edit Branch                            │
├────────────────────────────────────────────┤
│ Basic Information                          │
│ • Branch Name *                            │
│ • Branch Code * (Auto: BR-XXX)             │
│ • Branch Type * [Main / Sub]               │
│ • Status * [Active / Inactive]             │
│                                            │
│ Location                                   │
│ • Address *                                │
│ • City *                                   │
│ • State *                                  │
│ • ZIP Code                                 │
│                                            │
│ Contact Information                        │
│ • Phone *                                  │
│ • Email                                    │
│ • Manager Name *                           │
│                                            │
│ Business Information                       │
│ • Opening Date *                           │
│ • Monthly Sales Target (PKR)               │
│ • Employee Count                           │
│                                            │
│         [Cancel]  [Save Branch]            │
└────────────────────────────────────────────┘
```

**Validation:**
- Required fields marked with *
- Email format validation
- Phone number format (Pakistan: +92-XXX-XXXXXXX)
- Branch code uniqueness check
- Sales target must be > 0

### **6.4 Mock Data Example**

```typescript
const branchesMock = [
    {
        id: 1,
        name: "Main Branch - Karachi",
        code: "BR-001",
        location: "Gulshan-e-Iqbal, Karachi",
        phone: "+92-321-1234567",
        email: "karachi@dincollection.com",
        manager: "Ahmed Ali",
        status: "active",
        type: "main",
        salesTarget: 500000,
        currentSales: 380000,
        employeeCount: 12,
        openingDate: "2020-01-15"
    },
    {
        id: 2,
        name: "Sub Branch - Lahore",
        code: "BR-002",
        location: "DHA Phase 5, Lahore",
        phone: "+92-322-7654321",
        email: "lahore@dincollection.com",
        manager: "Sara Khan",
        status: "active",
        type: "sub",
        salesTarget: 300000,
        currentSales: 285000,
        employeeCount: 8,
        openingDate: "2021-06-20"
    }
];
```

### **6.5 Key Functions**

```typescript
// Add new branch
const handleAddBranch = (branchData: Branch) => {
    const newBranch = {
        ...branchData,
        id: Date.now(),
        code: generateBranchCode(),
        currentSales: 0,
        createdAt: new Date().toISOString()
    };
    setBranches([...branches, newBranch]);
    toast.success("Branch added successfully");
};

// Edit existing branch
const handleEditBranch = (id: number, branchData: Branch) => {
    const updated = branches.map(b => 
        b.id === id ? { ...b, ...branchData, updatedAt: new Date().toISOString() } : b
    );
    setBranches(updated);
    toast.success("Branch updated successfully");
};

// Delete branch
const handleDeleteBranch = (id: number) => {
    // Check if branch has active transactions
    const hasTransactions = checkBranchTransactions(id);
    if (hasTransactions) {
        toast.error("Cannot delete branch with active transactions");
        return;
    }
    
    setBranches(branches.filter(b => b.id !== id));
    toast.success("Branch deleted successfully");
};

// Generate unique branch code
const generateBranchCode = () => {
    const lastCode = branches[branches.length - 1]?.code || "BR-000";
    const number = parseInt(lastCode.split('-')[1]) + 1;
    return `BR-${number.toString().padStart(3, '0')}`;
};
```

---

## 7. Salesmen Management Module

### **7.1 Overview**
Complete sales team management with performance tracking and commission calculation.

### **7.2 Features**
- ✅ Salesman profiles with photos
- ✅ Commission rate configuration
- ✅ Performance metrics tracking
- ✅ Target vs achievement monitoring
- ✅ Status management (Active/Inactive/On-Leave)
- ✅ Branch assignment
- ✅ Salary & bank details
- ✅ Emergency contact information

### **7.3 Components**

#### **SalesmenTable.tsx**
Performance-focused table with metrics.

**Columns:**
```
┌──────┬──────────────┬─────────────┬──────────────┬─────────────┬─────────────┬─────────┐
│ Code │ Name         │ Branch      │ Monthly      │ Achievement │ Commission  │ Actions │
│      │              │             │ Sales        │             │             │         │
├──────┼──────────────┼─────────────┼──────────────┼─────────────┼─────────────┼─────────┤
│SM-001│ Ali Hassan   │ Karachi     │ 185K / 200K  │ ████████░ 93%│ PKR 4,625  │ [View]  │
│      │ 📸 +92-321   │             │              │ 🟢          │             │ [Edit]  │
├──────┼──────────────┼─────────────┼──────────────┼─────────────┼─────────────┼─────────┤
│SM-002│ Sara Ahmed   │ Lahore      │ 220K / 200K  │ ██████████ 110%│ PKR 5,500│ [View]  │
│      │ 📸 +92-322   │             │              │ 🟢🏆        │             │ [Edit]  │
└──────┴──────────────┴─────────────┴──────────────┴─────────────┴─────────────┴─────────┘
```

**Status Indicators:**
- 🟢 Active
- 🔴 Inactive
- 🟡 On Leave
- 🏆 Target Achieved (>100%)

**Metrics Cards (Top of Page):**
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Total Salesmen   │ │ Active Salesmen  │ │ Total Monthly    │ │ Total Commission │
│                  │ │                  │ │ Sales            │ │                  │
│      24          │ │       21         │ │   PKR 4.2M       │ │   PKR 105K       │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

#### **SalesmanForm.tsx**
Comprehensive form with all details.

**Sections:**
```
┌────────────────────────────────────────────┐
│ Add/Edit Salesman                          │
├────────────────────────────────────────────┤
│ [📸 Photo Upload]                          │
│                                            │
│ Basic Information                          │
│ • Full Name *                              │
│ • Code * (Auto: SM-XXX)                    │
│ • CNIC * (42101-1234567-8)                 │
│ • Email                                    │
│ • Phone *                                  │
│ • Address *                                │
│                                            │
│ Employment Details                         │
│ • Branch * [Dropdown]                      │
│ • Joining Date *                           │
│ • Status * [Active/Inactive/On-Leave]      │
│                                            │
│ Compensation                               │
│ • Monthly Salary (PKR) *                   │
│ • Commission Rate (%) *                    │
│ • Monthly Sales Target (PKR) *             │
│                                            │
│ Banking Information                        │
│ • Bank Name                                │
│ • Account Number (IBAN)                    │
│                                            │
│ Emergency Contact                          │
│ • Contact Name                             │
│ • Contact Phone                            │
│ • Relationship                             │
│                                            │
│ Notes                                      │
│ • Additional Information                   │
│                                            │
│         [Cancel]  [Save Salesman]          │
└────────────────────────────────────────────┘
```

**Validation:**
- CNIC format: XXXXX-XXXXXXX-X
- Phone: +92-XXX-XXXXXXX
- Email format
- Commission rate: 0-100%
- Salary & target must be > 0

### **7.4 Performance Tracking**

#### **Achievement Calculation**
```typescript
const calculateAchievement = (salesman: Salesman) => {
    const achievement = (salesman.monthlySales / salesman.monthlyTarget) * 100;
    return {
        percentage: achievement.toFixed(1),
        status: achievement >= 100 ? 'achieved' : achievement >= 75 ? 'on-track' : 'behind',
        badge: achievement >= 100 ? '🏆' : achievement >= 75 ? '🟢' : '🟡'
    };
};
```

#### **Commission Calculation**
```typescript
const calculateCommission = (salesman: Salesman) => {
    // Commission on total sales
    const commission = (salesman.monthlySales * salesman.commissionRate) / 100;
    
    // Bonus for exceeding target
    if (salesman.monthlySales > salesman.monthlyTarget) {
        const excess = salesman.monthlySales - salesman.monthlyTarget;
        const bonus = (excess * 1.5) / 100; // 1.5% bonus on excess
        return commission + bonus;
    }
    
    return commission;
};
```

### **7.5 Reports**

**Salesman Performance Report:**
```
┌────────────────────────────────────────────────────────────────────────┐
│ Salesman Performance - January 2024                                    │
├──────┬──────────────┬────────────┬────────────┬─────────┬─────────────┤
│ Rank │ Name         │ Sales      │ Target     │ %       │ Commission  │
├──────┼──────────────┼────────────┼────────────┼─────────┼─────────────┤
│  1   │ Sara Ahmed   │ 220,000    │ 200,000    │ 110% 🏆 │ 5,500       │
│  2   │ Usman Khan   │ 195,000    │ 180,000    │ 108% 🏆 │ 4,875       │
│  3   │ Ali Hassan   │ 185,000    │ 200,000    │  93% 🟢 │ 4,625       │
│  4   │ Zainab Ali   │ 172,000    │ 200,000    │  86% 🟢 │ 4,300       │
└──────┴──────────────┴────────────┴────────────┴─────────┴─────────────┘
```

---

## 8. Inventory Management Module

### **8.1 Overview**
Complete product and stock management system.

### **8.2 Features**
- ✅ Product catalog management
- ✅ Multi-category support
- ✅ Stock level tracking
- ✅ Low stock alerts
- ✅ Reorder point management
- ✅ Variation support (Size/Color)
- ✅ Packing support (Thaans/Meters)
- ✅ Pricing tiers (Cost/Sale/Wholesale/Rental)
- ✅ Supplier tracking
- ✅ Product images

### **8.3 Components**

#### **ProductsTable.tsx**
Comprehensive product listing.

**Columns:**
```
┌──────────┬─────────────────────┬──────────┬────────┬────────────┬─────────┬─────────┐
│ SKU      │ Product Name        │ Category │ Stock  │ Pricing    │ Status  │ Actions │
├──────────┼─────────────────────┼──────────┼────────┼────────────┼─────────┼─────────┤
│ BRD-001  │ Bridal Lehenga Red  │ Bridal   │   3    │ Cost: 45K  │ 🟢 Active│ [Edit]  │
│          │ [M] [Red]           │          │ 🟢     │ Sale: 85K  │         │ [Delete]│
│          │                     │          │        │ Rent: 8.5K │         │         │
├──────────┼─────────────────────┼──────────┼────────┼────────────┼─────────┼─────────┤
│ FAB-050  │ Cotton Lawn White   │ Fabric   │  250   │ Cost: 600  │ 🟢 Active│ [Edit]  │
│          │ [Packing: Thaans]   │          │ 🟢     │ Sale: 850  │         │ [Delete]│
│          │                     │          │        │ Whsl: 750  │         │         │
├──────────┼─────────────────────┼──────────┼────────┼────────────┼─────────┼─────────┤
│ ACC-012  │ Jewelry Set Gold    │ Access.  │   2    │ Cost: 12K  │ 🔴 Low  │ [Edit]  │
│          │                     │          │ 🔴🔔   │ Sale: 18K  │ Stock!  │ [Delete]│
└──────────┴─────────────────────┴──────────┴────────┴────────────┴─────────┴─────────┘
```

**Stock Level Indicators:**
- 🟢 Good (> Reorder Point)
- 🟡 Low (At Reorder Point)
- 🔴🔔 Critical (Below Min Level)

**Status:**
- 🟢 Active
- 🟡 Inactive
- 🔴 Discontinued

#### **ProductForm.tsx**
Comprehensive product form with tabs.

**Tab 1: Basic Information**
```
┌────────────────────────────────────────────┐
│ Basic Information                          │
├────────────────────────────────────────────┤
│ • Product Name *                           │
│ • SKU * (Auto: PRD-XXX)                    │
│ • Category * [Dropdown]                    │
│   - Bridal                                 │
│   - Fabric                                 │
│   - Accessories                            │
│   - Footwear                               │
│ • Subcategory                              │
│ • Brand                                    │
│ • Description [Textarea]                   │
│ • Status * [Active/Inactive/Discontinued]  │
└────────────────────────────────────────────┘
```

**Tab 2: Pricing**
```
┌────────────────────────────────────────────┐
│ Pricing Information                        │
├────────────────────────────────────────────┤
│ • Cost Price (PKR) *                       │
│ • Sale Price (PKR) *                       │
│ • Wholesale Price (PKR)                    │
│ • Rental Price (PKR/Day)                   │
│                                            │
│ Profit Margins (Auto-calculated)           │
│ • Sale Margin: 47% (PKR 40,000)            │
│ • Wholesale Margin: 25% (PKR 15,000)       │
└────────────────────────────────────────────┘
```

**Tab 3: Stock Management**
```
┌────────────────────────────────────────────┐
│ Stock Management                           │
├────────────────────────────────────────────┤
│ • Current Stock * (Units)                  │
│ • Minimum Stock Level * (Alert)            │
│ • Maximum Stock Level                      │
│ • Reorder Point *                          │
│                                            │
│ Stock Alerts                               │
│ ☑ Enable Low Stock Alert                   │
│ ☑ Auto-create Purchase Order at Reorder    │
└────────────────────────────────────────────┘
```

**Tab 4: Attributes**
```
┌────────────────────────────────────────────┐
│ Product Attributes                         │
├────────────────────────────────────────────┤
│ ☑ Has Variations (Size/Color)              │
│   • Available Sizes: [S, M, L, XL]         │
│   • Available Colors: [Red, Blue, Black]   │
│                                            │
│ ☑ Needs Packing (Thaans/Meters)            │
│   • Standard Thaan: 15 meters              │
│                                            │
│ ☑ Available for Rental                     │
│                                            │
│ Physical Properties                        │
│ • Material                                 │
│ • Weight (kg)                              │
│ • Dimensions (LxWxH)                       │
└────────────────────────────────────────────┘
```

**Tab 5: Supplier**
```
┌────────────────────────────────────────────┐
│ Supplier Information                       │
├────────────────────────────────────────────┤
│ • Supplier [Dropdown]                      │
│ • Supplier SKU                             │
│ • Lead Time (Days)                         │
│ • Last Purchase Date                       │
│ • Last Purchase Price                      │
└────────────────────────────────────────────┘
```

**Tab 6: Images**
```
┌────────────────────────────────────────────┐
│ Product Images                             │
├────────────────────────────────────────────┤
│ Thumbnail:                                 │
│ [📸 Upload] [Preview]                      │
│                                            │
│ Gallery Images:                            │
│ [📸] [📸] [📸] [📸] [+]                     │
│                                            │
│ • Max 5 images                             │
│ • Recommended: 800x800px                   │
│ • Format: JPG, PNG                         │
│ • Max size: 2MB per image                  │
└────────────────────────────────────────────┘
```

#### **StockAlerts.tsx**
Real-time stock monitoring dashboard.

**Stock Alert Cards:**
```
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ Critical            │ │ Low Stock           │ │ Reorder Point       │
│ Below Min Level     │ │ Below Reorder       │ │ At Reorder Level    │
│                     │ │                     │ │                     │
│      🔴 3           │ │      🟡 8           │ │      🟠 12          │
│    Products         │ │    Products         │ │    Products         │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

**Alert Table:**
```
┌─────────┬───────────────────────┬──────────────┬───────────┬─────────────┐
│ Priority│ Product               │ Current Stock│ Min Level │ Action      │
├─────────┼───────────────────────┼──────────────┼───────────┼─────────────┤
│ 🔴 HIGH │ Jewelry Set Gold      │      2       │     5     │ [Order Now] │
│ 🔴 HIGH │ Bridal Veil White     │      1       │     3     │ [Order Now] │
│ 🟡 MED  │ Silk Dupatta Pink     │      8       │    10     │ [Order]     │
│ 🟠 LOW  │ Cotton Fabric Blue    │     50       │    75     │ [Review]    │
└─────────┴───────────────────────┴──────────────┴───────────┴─────────────┘
```

**Actions:**
- Quick create purchase order
- Adjust stock levels
- Update reorder points
- Disable alerts temporarily

### **8.4 Stock Movements**

**Transaction Types:**
```
┌──────────────────┬─────────────────────────────────┐
│ Type             │ Effect on Stock                 │
├──────────────────┼─────────────────────────────────┤
│ Purchase Received│ Stock ↑ (Increase)              │
│ Sale Completed   │ Stock ↓ (Decrease)              │
│ Rental Out       │ Stock ↓ (Reserved)              │
│ Rental Return    │ Stock ↑ (Released)              │
│ Stock Adjustment │ Stock ± (Manual)                │
│ Damage/Loss      │ Stock ↓ (Write-off)             │
│ Transfer In      │ Stock ↑ (From other branch)     │
│ Transfer Out     │ Stock ↓ (To other branch)       │
└──────────────────┴─────────────────────────────────┘
```

**Stock Movement Log:**
```typescript
interface StockMovement {
    id: number;
    productId: number;
    productName: string;
    sku: string;
    type: 'purchase' | 'sale' | 'rental-out' | 'rental-return' | 'adjustment' | 'damage' | 'transfer';
    quantity: number;
    previousStock: number;
    newStock: number;
    referenceType?: string;
    referenceId?: number;
    notes?: string;
    branchId: number;
    userId: number;
    userName: string;
    createdAt: string;
}
```

---

## 9. Sales Module

### **9.1 Overview**
Complete sales transaction management with multi-status workflow.

### **9.2 Features**
- ✅ Multi-status workflow (Draft → Quotation → Order → Final)
- ✅ Customer management
- ✅ Product search with barcode support
- ✅ Variation support (Size/Color)
- ✅ Packing support (Thaans/Meters)
- ✅ Flexible discount (% or Fixed)
- ✅ Multiple payment methods
- ✅ Partial payments tracking
- ✅ Salesman commission calculation
- ✅ Shipping management
- ✅ Extra expenses
- ✅ Invoice generation

### **9.3 Status Workflow**

```
Draft ──────▶ Quotation ──────▶ Order ──────▶ Final
  🔘              🟡              🔵             🟢
  Gray          Yellow           Blue          Green

• Draft: Initial entry, can be edited freely
• Quotation: Price quote sent to customer
• Order: Confirmed order, payment pending/partial
• Final: Completed sale, payment received
```

### **9.4 Sale Form Structure**

**Header Section:**
```
┌────────────────────────────────────────────────────────────────────┐
│ [Status: Quotation ▼] [Customer ▼] [Date] [Ref#] [Invoice#]       │
│   🟡 Yellow                                                         │
│                                                                    │
│ [Salesman ▼] [Type: Regular ▼] [Branch ▼]                         │
│   🟢 Green      🛍️               🏢                                │
└────────────────────────────────────────────────────────────────────┘
```

**Items Entry Section:**
```
┌────────────────────────────────────────────────────────────────────┐
│ Add Items                                                          │
├────────────────────────────────────────────────────────────────────┤
│ [🔍 Find Product________________________________] 🔵 Blue          │
│                                                                    │
│ ──────── Product Selected ────────                                │
│                                                                    │
│ [Product✕] [Size▼] [Color▼] [Thaans] [Meters] [Qty] [Price] [Add]│
│             🟣      🟣       🟠       🟠                            │
└────────────────────────────────────────────────────────────────────┘
```

**Items Table:**
```
┌────┬────────────────────────────────┬─────────────────┬──────┬─────┬────────┬───┐
│ #  │ Product Details                │ Packing Info    │Price │ Qty │ Total  │ X │
├────┼────────────────────────────────┼─────────────────┼──────┼─────┼────────┼───┤
│ 01 │ Silk Dupatta                   │ —               │ 1800 │  2  │ 3,600  │🗑️│
│    │ SLK-022 • [M] • [Red]          │                 │      │     │        │   │
├────┼────────────────────────────────┼─────────────────┼──────┼─────┼────────┼───┤
│ 02 │ Premium Cotton Fabric          │ [📦 3 Th]       │  850 │  1  │   850  │🗑️│
│    │ FAB-001                        │ [📏 45M]        │      │     │        │   │
└────┴────────────────────────────────┴─────────────────┴──────┴─────┴────────┴───┘

Subtotal: PKR 4,450
```

**Pricing Section:**
```
┌────────────────────────────────────────────┐
│ Pricing & Discounts                        │
├────────────────────────────────────────────┤
│ Subtotal:              PKR 4,450           │
│                                            │
│ Discount:                                  │
│ • Type: [Percentage ▼]                     │
│ • Value: [10] %                            │
│ • Amount: PKR -445                         │
│                                            │
│ Extra Expenses:                            │
│ • [+ Add Expense]                          │
│   - Delivery Charges: PKR 200              │
│                                            │
│ Shipping: [☑ Enable]                       │
│ • Charges: PKR 500                         │
│                                            │
│ ──────────────────────────────────────────│
│ TOTAL:                 PKR 4,705           │
└────────────────────────────────────────────┘
```

**Payment Section:**
```
┌────────────────────────────────────────────┐
│ Payment Details                            │
├────────────────────────────────────────────┤
│ Total Amount:          PKR 4,705           │
│                                            │
│ Partial Payments:                          │
│ ┌────────────────────────────────────────┐ │
│ │ Date       Method  Amount      [Remove]│ │
│ ├────────────────────────────────────────┤ │
│ │ 15-Jan     Cash    PKR 2,000   [🗑️]    │ │
│ │ 16-Jan     Bank    PKR 1,000   [🗑️]    │ │
│ └────────────────────────────────────────┘ │
│ [+ Add Payment]                            │
│                                            │
│ Paid Amount:           PKR 3,000  🟡       │
│ Balance Due:           PKR 1,705  🔴       │
│                                            │
│ Status:  🟡 Partial Payment                │
└────────────────────────────────────────────┘
```

**Commission Section:**
```
┌────────────────────────────────────────────┐
│ Salesman Commission                        │
├────────────────────────────────────────────┤
│ Salesman: Ali Hassan (SM-001)             │
│ Commission Rate: 2.5%                      │
│                                            │
│ Type: [Percentage ▼]                       │
│ Value: [2.5] %                             │
│                                            │
│ Commission Amount: PKR 111.25              │
└────────────────────────────────────────────┘
```

**Notes Section:**
```
┌────────────────────────────────────────────┐
│ Additional Information                     │
├────────────────────────────────────────────┤
│ Customer Notes:                            │
│ [_______________________________________]  │
│                                            │
│ Internal Notes:                            │
│ [_______________________________________]  │
│                                            │
│ Shipping Address:                          │
│ [_______________________________________]  │
└────────────────────────────────────────────┘
```

**Footer Actions:**
```
┌────────────────────────────────────────────┐
│ [Cancel] [Save as Draft] [Create Sale] 🟢  │
└────────────────────────────────────────────┘
```

### **9.5 Sales Metrics Dashboard**

**Overview Cards:**
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Today's Sales    │ │ This Month       │ │ Total Credit     │ │ Total Orders     │
│                  │ │                  │ │                  │ │                  │
│ PKR 45,500       │ │ PKR 2.8M         │ │ PKR 850K         │ │      127         │
│ +12.5% ↑         │ │ +18% ↑           │ │ 24 customers     │ │ 18 pending       │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

**Sales Chart (Recharts):**
```
Daily Sales Trend (Last 30 Days)
PKR
100K ┤     ╭─╮
 80K ┤   ╭─╯ ╰─╮     ╭╮
 60K ┤ ╭─╯     ╰─╮ ╭─╯╰╮
 40K ┤─╯         ╰─╯   ╰─
 20K ┤
  0  └────────────────────────
     1   5   10  15  20  25  30
```

**Top Selling Products:**
```
┌────┬───────────────────────┬──────────┬─────────┬───────────┐
│ #  │ Product               │ Qty Sold │ Revenue │ Trend     │
├────┼───────────────────────┼──────────┼─────────┼───────────┤
│ 1  │ Bridal Lehenga Red    │    12    │  1.02M  │ ▲ +15%    │
│ 2  │ Silk Dupatta Set      │    45    │  810K   │ ▲ +22%    │
│ 3  │ Cotton Lawn Print     │   128    │  640K   │ ▼ -5%     │
└────┴───────────────────────┴──────────┴─────────┴───────────┘
```

**Sales by Status:**
```
┌────────────┬───────┬─────────┬──────────┐
│ Status     │ Count │ Amount  │ %        │
├────────────┼───────┼─────────┼──────────┤
│ 🔘 Draft   │   12  │  180K   │  6.4%    │
│ 🟡 Quotation│   8  │  320K   │ 11.4%    │
│ 🔵 Order   │  18  │  950K   │ 33.9%    │
│ 🟢 Final   │  89  │ 1.35M   │ 48.2%    │
└────────────┴───────┴─────────┴──────────┘
```

### **9.6 Payment Status Logic**

```typescript
// Automatic payment status detection
const calculatePaymentStatus = (totalAmount: number, paidAmount: number) => {
    if (paidAmount === 0) {
        return {
            status: 'credit',
            label: 'Credit',
            color: 'red',
            icon: '🔴'
        };
    } else if (paidAmount >= totalAmount) {
        return {
            status: 'paid',
            label: 'Paid',
            color: 'green',
            icon: '🟢'
        };
    } else {
        return {
            status: 'partial',
            label: 'Partial',
            color: 'yellow',
            icon: '🟡'
        };
    }
};
```

---

## 10. Purchase Module

### **10.1 Overview**
Complete purchase order management for inventory replenishment.

### **10.2 Features**
- ✅ Multi-status workflow (Draft → Ordered → Received → Final)
- ✅ Supplier management
- ✅ Expected vs Actual delivery tracking
- ✅ Product selection with variations
- ✅ Packing support (Thaans/Meters)
- ✅ Flexible discount
- ✅ Partial payments
- ✅ Automatic stock update on receive
- ✅ Bill management

### **10.3 Status Workflow**

```
Draft ──────▶ Ordered ──────▶ Received ──────▶ Final
  🔘            🟡              🔵              🟢
  Gray         Yellow           Blue           Green

• Draft: Purchase order being prepared
• Ordered: PO sent to supplier, awaiting delivery
• Received: Items received, pending final verification
• Final: Purchase completed, stock updated, payment settled
```

### **10.4 Purchase Form Structure**

Similar to Sale Form but with supplier-specific fields:

**Header:**
```
┌────────────────────────────────────────────────────────────────────┐
│ [Status: Ordered ▼] [Supplier ▼] [Date] [Bill#] [Expected Date]   │
│   🟡 Yellow                                                         │
│                                                                    │
│ [Branch ▼] [Reference#]                                            │
└────────────────────────────────────────────────────────────────────┘
```

**Key Differences from Sales:**
- Supplier instead of Customer
- Expected Delivery Date field
- Received Date field (appears when status = Received)
- No Commission section
- No Salesman field
- Bill Number instead of Invoice Number

### **10.5 Supplier Management**

```typescript
interface Supplier {
    id: number;
    name: string;
    code: string;           // e.g., "SUP-001"
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    taxNumber?: string;     // NTN/GST
    
    // Terms
    paymentTerms: string;   // e.g., "Net 30 Days"
    creditLimit: number;
    currentCredit: number;
    
    // Performance
    totalPurchases: number;
    totalOrders: number;
    averageDeliveryDays: number;
    rating: number;         // 1-5 stars
    
    status: 'active' | 'inactive';
    createdAt: string;
}
```

### **10.6 Purchase Metrics**

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ This Month       │ │ Pending Orders   │ │ Total Payable    │ │ Received Today   │
│                  │ │                  │ │                  │ │                  │
│ PKR 1.2M         │ │      15          │ │ PKR 450K         │ │   PKR 85K        │
│ 42 orders        │ │ PKR 380K         │ │ 8 suppliers      │ │   3 orders       │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 11. Accounting Module

### **11.1 Overview**
Double-entry bookkeeping system with chart of accounts.

### **11.2 Features**
- ✅ Chart of Accounts (COA)
- ✅ Double-entry transactions
- ✅ Account types (Asset, Liability, Equity, Revenue, Expense)
- ✅ Transaction journal
- ✅ General ledger
- ✅ Trial balance
- ✅ Profit & Loss statement
- ✅ Balance sheet
- ✅ Cash flow statement

### **11.3 Account Types**

```
1. Assets (1000-1999)
   ├── Current Assets (1000-1499)
   │   ├── Cash (1001-1099)
   │   ├── Bank Accounts (1100-1199)
   │   ├── Accounts Receivable (1200-1299)
   │   └── Inventory (1300-1399)
   └── Fixed Assets (1500-1999)
       ├── Property (1501-1599)
       ├── Equipment (1600-1699)
       └── Vehicles (1700-1799)

2. Liabilities (2000-2999)
   ├── Current Liabilities (2000-2499)
   │   ├── Accounts Payable (2001-2099)
   │   ├── Short-term Loans (2100-2199)
   │   └── Accrued Expenses (2200-2299)
   └── Long-term Liabilities (2500-2999)

3. Equity (3000-3999)
   ├── Owner's Equity (3001-3099)
   ├── Retained Earnings (3100-3199)
   └── Drawings (3200-3299)

4. Revenue (4000-4999)
   ├── Sales Revenue (4001-4099)
   ├── Rental Revenue (4100-4199)
   └── Other Income (4900-4999)

5. Expenses (5000-5999)
   ├── Cost of Goods Sold (5001-5099)
   ├── Operating Expenses (5100-5899)
   └── Financial Expenses (5900-5999)
```

### **11.4 Transaction Entry**

```
┌────────────────────────────────────────────┐
│ Journal Entry                              │
├────────────────────────────────────────────┤
│ Date: [15-Jan-2024]                        │
│ Reference: [SAL-2024-001]                  │
│ Description: [Sale to Ayesha Khan]         │
│                                            │
│ Debit Entries:                             │
│ ┌────────────────────────────────────────┐ │
│ │ Account          | Amount              │ │
│ ├──────────────────┼─────────────────────┤ │
│ │ Cash in Hand     | PKR 3,000           │ │
│ │ Acc. Receivable  | PKR 1,705           │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Credit Entries:                            │
│ ┌────────────────────────────────────────┐ │
│ │ Account          | Amount              │ │
│ ├──────────────────┼─────────────────────┤ │
│ │ Sales Revenue    | PKR 4,705           │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Total Debit:  PKR 4,705                    │
│ Total Credit: PKR 4,705  ✓ Balanced        │
│                                            │
│         [Cancel]  [Save Entry]             │
└────────────────────────────────────────────┘
```

### **11.5 Financial Reports**

#### **Trial Balance**
```
Trial Balance - As of 31 January 2024
┌──────────────────────┬────────────┬────────────┐
│ Account              │ Debit      │ Credit     │
├──────────────────────┼────────────┼────────────┤
│ ASSETS               │            │            │
│ Cash in Hand         │   125,000  │            │
│ Bank Account         │   850,000  │            │
│ Accounts Receivable  │   450,000  │            │
│ Inventory            │ 2,850,000  │            │
│                      │            │            │
│ LIABILITIES          │            │            │
│ Accounts Payable     │            │   250,000  │
│ Short-term Loan      │            │   500,000  │
│                      │            │            │
│ EQUITY               │            │            │
│ Owner's Equity       │            │ 2,000,000  │
│ Retained Earnings    │            │   850,000  │
│                      │            │            │
│ REVENUE              │            │            │
│ Sales Revenue        │            │ 2,850,000  │
│ Rental Revenue       │            │   450,000  │
│                      │            │            │
│ EXPENSES             │            │            │
│ COGS                 │ 1,200,000  │            │
│ Rent Expense         │   255,000  │            │
│ Salary Expense       │   840,000  │            │
│ Utilities            │    45,000  │            │
├──────────────────────┼────────────┼────────────┤
│ TOTAL                │ 6,615,000  │ 6,900,000  │
└──────────────────────┴────────────┴────────────┘
```

#### **Profit & Loss Statement**
```
Profit & Loss Statement
For the Month Ended 31 January 2024

REVENUE
Sales Revenue                       PKR 2,850,000
Rental Revenue                      PKR   450,000
                                   ─────────────
Total Revenue                       PKR 3,300,000

COST OF GOODS SOLD
Opening Stock                       PKR 2,500,000
Purchases                           PKR 1,200,000
                                   ─────────────
Goods Available                     PKR 3,700,000
Less: Closing Stock                (PKR 2,850,000)
                                   ─────────────
Cost of Goods Sold                  PKR   850,000

GROSS PROFIT                        PKR 2,450,000

OPERATING EXPENSES
Rent Expense                        PKR   255,000
Salary Expense                      PKR   840,000
Utilities Expense                   PKR    45,000
Marketing Expense                   PKR    35,000
                                   ─────────────
Total Operating Expenses            PKR 1,175,000

NET PROFIT                          PKR 1,275,000
                                   =============

Gross Profit Margin: 74.2%
Net Profit Margin: 38.6%
```

#### **Balance Sheet**
```
Balance Sheet
As of 31 January 2024

ASSETS
Current Assets
  Cash in Hand                      PKR   125,000
  Bank Accounts                     PKR   850,000
  Accounts Receivable               PKR   450,000
  Inventory                         PKR 2,850,000
                                   ─────────────
Total Current Assets                PKR 4,275,000

Fixed Assets
  Property                          PKR 5,000,000
  Equipment                         PKR   750,000
  Vehicles                          PKR 1,200,000
  Less: Accumulated Depreciation   (PKR   425,000)
                                   ─────────────
Total Fixed Assets                  PKR 6,525,000
                                   ─────────────
TOTAL ASSETS                        PKR10,800,000
                                   =============

LIABILITIES
Current Liabilities
  Accounts Payable                  PKR   250,000
  Short-term Loan                   PKR   500,000
                                   ─────────────
Total Current Liabilities           PKR   750,000

Long-term Liabilities
  Long-term Loan                    PKR 2,000,000
                                   ─────────────
TOTAL LIABILITIES                   PKR 2,750,000

EQUITY
  Owner's Equity                    PKR 2,000,000
  Retained Earnings                 PKR 6,050,000
                                   ─────────────
TOTAL EQUITY                        PKR 8,050,000
                                   ─────────────
TOTAL LIABILITIES & EQUITY          PKR10,800,000
                                   =============
```

---

## 12. Expenses Module

### **12.1 Overview**
Comprehensive expense tracking and management system.

### **12.2 Features**
- ✅ Expense categories management
- ✅ Receipt attachments
- ✅ Approval workflow
- ✅ Payment tracking
- ✅ Branch-wise expenses
- ✅ Expense reports
- ✅ Budget tracking

### **12.3 Expense Categories**

```
1. Rent & Utilities
   ├── Shop Rent
   ├── Electricity
   ├── Water
   └── Internet

2. Salaries & Wages
   ├── Permanent Staff
   ├── Contract Workers
   └── Overtime

3. Marketing & Advertising
   ├── Social Media Ads
   ├── Print Media
   ├── Events & Sponsorships
   └── Promotional Items

4. Office Supplies
   ├── Stationery
   ├── Printing
   └── Maintenance

5. Transportation
   ├── Fuel
   ├── Vehicle Maintenance
   └── Delivery Charges

6. Professional Fees
   ├── Accounting Services
   ├── Legal Services
   └── Consultancy

7. Taxes & Licenses
   ├── Business License
   ├── Trade License
   └── Sales Tax

8. Other Expenses
```

### **12.4 Expense Form**

```
┌────────────────────────────────────────────┐
│ Record Expense                             │
├────────────────────────────────────────────┤
│ Date: [15-Jan-2024]                        │
│ Expense Number: [Auto: EXP-2024-001]       │
│                                            │
│ Category: [Utilities ▼]                    │
│ Subcategory: [Electricity ▼]               │
│                                            │
│ Title: *                                   │
│ [Electricity Bill - December 2023]         │
│                                            │
│ Description:                               │
│ [_______________________________________]  │
│                                            │
│ Amount: * (PKR)                            │
│ [12,500]                                   │
│                                            │
│ Payment Method: [Cash ▼]                   │
│ • Cash                                     │
│ • Bank Transfer                            │
│ • Cheque                                   │
│ • Card                                     │
│                                            │
│ Paid To: *                                 │
│ [K-Electric]                               │
│                                            │
│ Receipt Number:                            │
│ [KE-123456]                                │
│                                            │
│ Attachments:                               │
│ [📎 Upload Receipt] (Max 5MB)              │
│ • receipt.jpg ✓                            │
│                                            │
│ Branch: [Main Branch - Karachi ▼]          │
│                                            │
│ Approval Status: [Pending ▼]               │
│ • Pending                                  │
│ • Approved                                 │
│ • Rejected                                 │
│                                            │
│ Account Link: [Utilities Expense ▼]        │
│                                            │
│ Notes:                                     │
│ [_______________________________________]  │
│                                            │
│         [Cancel]  [Save Expense]           │
└────────────────────────────────────────────┘
```

### **12.5 Expenses Dashboard**

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ This Month       │ │ Pending Approval │ │ Top Category     │ │ Budget Remaining │
│                  │ │                  │ │                  │ │                  │
│ PKR 325,000      │ │       8          │ │ Salaries         │ │ PKR 175,000      │
│ +8% from last    │ │ PKR 45,000       │ │ PKR 120,000      │ │ 35% of budget    │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

**Expenses by Category (Chart):**
```
Category Breakdown - January 2024

Salaries       ██████████████████████ 37%  PKR 120,000
Rent           ████████████████ 26%         PKR  85,000
Utilities      ████████ 14%                 PKR  45,000
Marketing      ██████ 9%                    PKR  30,000
Transport      ████ 6%                      PKR  20,000
Other          ██ 8%                        PKR  25,000
```

**Recent Expenses:**
```
┌──────────────┬────────────────────────────┬───────────┬──────────┬────────────┐
│ Date         │ Description                │ Category  │ Amount   │ Status     │
├──────────────┼────────────────────────────┼───────────┼──────────┼────────────┤
│ 15-Jan-2024  │ Electricity Bill - Dec     │ Utilities │  12,500  │ ✅ Approved │
│ 14-Jan-2024  │ Facebook Ads Campaign      │ Marketing │  15,000  │ ⏳ Pending  │
│ 13-Jan-2024  │ Vehicle Fuel               │ Transport │   3,500  │ ✅ Approved │
│ 12-Jan-2024  │ Office Stationery          │ Supplies  │   4,200  │ ✅ Approved │
└──────────────┴────────────────────────────┴───────────┴──────────┴────────────┘
```

---

## 13. Rental Management Module

### **13.1 Overview**
Complete rental booking and tracking system for bridal wear.

### **13.2 Features**
- ✅ Booking calendar view
- ✅ Customer CNIC verification
- ✅ Security deposit management
- ✅ Damage assessment
- ✅ Late fee calculation
- ✅ Return processing
- ✅ Rental history
- ✅ Availability checking

### **13.3 Rental Workflow**

```
Booked ──▶ Confirmed ──▶ Ongoing ──▶ Returned ──▶ Closed
  🔘         🟡           🔵         🟠          🟢
  Gray      Yellow        Blue      Orange      Green

Alternate: Cancelled 🔴

• Booked: Initial reservation, deposit pending
• Confirmed: Deposit paid, booking secured
• Ongoing: Customer has taken the item
• Returned: Item returned, inspection pending
• Closed: Completed, deposit refunded (if applicable)
• Cancelled: Booking cancelled by customer/shop
```

### **13.4 Rental Form**

**Customer Information:**
```
┌────────────────────────────────────────────┐
│ Customer Information                       │
├────────────────────────────────────────────┤
│ Customer Name: *                           │
│ [Fatima Ahmed]                             │
│                                            │
│ Phone: *                                   │
│ [+92-321-7654321]                          │
│                                            │
│ CNIC: * (Required for Rental)              │
│ [42101-9876543-2]                          │
│                                            │
│ Address: *                                 │
│ [House 456, DHA Phase 5, Karachi]          │
│                                            │
│ Email:                                     │
│ [fatima@email.com]                         │
└────────────────────────────────────────────┘
```

**Event Details:**
```
┌────────────────────────────────────────────┐
│ Event Information                          │
├────────────────────────────────────────────┤
│ Event Type: * [Wedding ▼]                  │
│ • Wedding                                  │
│ • Party                                    │
│ • Photoshoot                               │
│ • Other                                    │
│                                            │
│ Event Date: *                              │
│ [15-Feb-2024]                              │
│                                            │
│ Venue:                                     │
│ [Pearl Continental Hotel, Karachi]         │
└────────────────────────────────────────────┘
```

**Rental Period:**
```
┌────────────────────────────────────────────┐
│ Rental Duration                            │
├────────────────────────────────────────────┤
│ Rental Start Date: *                       │
│ [14-Feb-2024] 10:00 AM                     │
│                                            │
│ Rental End Date: *                         │
│ [17-Feb-2024] 06:00 PM                     │
│                                            │
│ Duration: 3 Days (Auto-calculated)         │
│                                            │
│ ⚠ Late Return Charges:                     │
│ PKR 2,000/day after end date               │
└────────────────────────────────────────────┘
```

**Items Selection:**
```
┌────────────────────────────────────────────┐
│ Rental Items                               │
├────────────────────────────────────────────┤
│ [🔍 Search Available Products...]          │
│                                            │
│ Selected Items:                            │
│ ┌────────────────────────────────────────┐ │
│ │ Product        Rate    Days   Total    │ │
│ ├────────────────────────────────────────┤ │
│ │ Bridal Lehenga 8,500   3      25,500 🗑️│ │
│ │ BRD-001                                │ │
│ │ Condition: ✓ Excellent                 │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Rental Amount:     PKR 25,500              │
│ Security Deposit:  PKR 20,000              │
│                   ──────────               │
│ Total:            PKR 45,500               │
└────────────────────────────────────────────┘
```

**Delivery Options:**
```
┌────────────────────────────────────────────┐
│ Delivery                                   │
├────────────────────────────────────────────┤
│ ☑ Delivery Required                        │
│                                            │
│ Delivery Address:                          │
│ [Pearl Continental Hotel, Karachi]         │
│                                            │
│ Delivery Charges: PKR 2,000                │
│ Delivery Date: [14-Feb-2024]               │
│ Delivery Time: [09:00 AM]                  │
│                                            │
│ ☑ Pickup Required                          │
│ Pickup Date: [17-Feb-2024]                 │
│ Pickup Time: [08:00 PM]                    │
└────────────────────────────────────────────┘
```

**Payment & Deposit:**
```
┌────────────────────────────────────────────┐
│ Payment Details                            │
├────────────────────────────────────────────┤
│ Rental Amount:        PKR 25,500           │
│ Security Deposit:     PKR 20,000           │
│ Delivery Charges:     PKR  2,000           │
│                      ──────────            │
│ Total Amount:         PKR 47,500           │
│                                            │
│ Payment Method: [Bank Transfer ▼]          │
│ Transaction Ref: [TRX-123456789]           │
│                                            │
│ Paid Amount:          PKR 47,500  ✓        │
│ Balance Due:          PKR      0           │
│                                            │
│ 🟢 Payment Status: Paid                    │
└────────────────────────────────────────────┘
```

**Special Instructions:**
```
┌────────────────────────────────────────────┐
│ Notes & Instructions                       │
├────────────────────────────────────────────┤
│ Customer Notes:                            │
│ [Customer needs fitting appointment on     │
│  12th Feb. VIP customer, handle with care.]│
│                                            │
│ Internal Notes:                            │
│ [Confirmed by phone. Deposit received via  │
│  bank transfer.]                           │
└────────────────────────────────────────────┘
```

### **13.5 Return Processing**

**Return Form:**
```
┌────────────────────────────────────────────┐
│ Process Return - RNT-2024-001              │
├────────────────────────────────────────────┤
│ Customer: Fatima Ahmed                     │
│ Rental Period: 14-Feb to 17-Feb (3 days)   │
│ Expected Return: 17-Feb-2024 06:00 PM      │
│                                            │
│ Actual Return Date: *                      │
│ [17-Feb-2024] [06:30 PM]                   │
│                                            │
│ Late Return: 0.5 hours                     │
│ Late Charges: PKR 0 (Within grace period)  │
│                                            │
│ ────────────────────────────────────────── │
│                                            │
│ Item Inspection:                           │
│ ┌────────────────────────────────────────┐ │
│ │ Item: Bridal Lehenga (BRD-001)         │ │
│ │                                        │ │
│ │ Condition Out: ✓ Excellent             │ │
│ │                                        │ │
│ │ Condition In: [Good ▼]                 │ │
│ │ • Excellent                            │ │
│ │ • Good                                 │ │
│ │ • Fair                                 │ │
│ │ • Damaged                              │ │
│ │                                        │ │
│ │ Damage Assessment:                     │ │
│ │ ☐ Minor stain on dupatta               │ │
│ │   Cleaning Charges: PKR 1,500          │ │
│ │                                        │ │
│ │ ☐ Missing accessories                  │ │
│ │   Replacement Cost: PKR ______         │ │
│ │                                        │ │
│ │ Photos:                                │ │
│ │ [📷 Upload Photos]                     │ │
│ │                                        │ │
│ │ Notes:                                 │ │
│ │ [Minor stain, will clean in-house]    │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ────────────────────────────────────────── │
│                                            │
│ Settlement:                                │
│ Security Deposit:     PKR 20,000           │
│ Late Charges:        -PKR      0           │
│ Damage Charges:      -PKR  1,500           │
│                      ──────────            │
│ Refund Amount:        PKR 18,500           │
│                                            │
│ Refund Method: [Cash ▼]                    │
│                                            │
│         [Cancel]  [Complete Return]        │
└────────────────────────────────────────────┘
```

### **13.6 Rental Calendar**

**Calendar View:**
```
February 2024 - Rental Schedule

                Mon   Tue   Wed   Thu   Fri   Sat   Sun
Week 1           5     6     7     8     9    10    11
                      █     █

Week 2          12    13    14    15    16    17    18
                      █     █     █     █     █

Week 3          19    20    21    22    23    24    25
                                  █     █     █

Legend:
█ Booked/Confirmed
▒ Ongoing
░ Returned (pending inspection)

Click any date to see bookings:
• 14-Feb: Bridal Lehenga (BRD-001) - Fatima Ahmed
• 14-Feb: Wedding Sherwani (GRM-005) - Ahmed Khan
```

**Availability Check:**
```
┌────────────────────────────────────────────┐
│ Check Availability                         │
├────────────────────────────────────────────┤
│ Product: [Bridal Lehenga - Red ▼]          │
│                                            │
│ Date Range:                                │
│ From: [20-Feb-2024]                        │
│ To:   [23-Feb-2024]                        │
│                                            │
│ [Check Availability]                       │
│                                            │
│ Result:                                    │
│ ✅ Available for selected dates            │
│                                            │
│ Upcoming Bookings:                         │
│ • 25-Feb to 28-Feb: Ayesha Khan (RNT-012)  │
│ • 5-Mar to 8-Mar: Sara Ahmed (RNT-018)     │
└────────────────────────────────────────────┘
```

---

## 14. POS (Point of Sale) Module

### **14.1 Overview**
Quick sale interface for counter transactions.

### **14.2 Features**
- ✅ Fast product search
- ✅ Barcode scanning
- ✅ Quick add to cart
- ✅ Multiple payment methods
- ✅ Split payments
- ✅ Customer display
- ✅ Receipt printing
- ✅ Day-end closing
- ✅ Cash drawer management

### **14.3 POS Interface Layout**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ POS - Main Branch Karachi          Cashier: Ali Hassan    [Day End] [≡] │
├──────────────────────────────────┬──────────────────────────────────────┤
│                                  │                                      │
│  PRODUCT SEARCH & CATALOG        │      CART & CHECKOUT                 │
│                                  │                                      │
│  ┌────────────────────────────┐  │  Customer: Walk-in                   │
│  │🔍 Search or Scan...        │  │  ┌────────────────────────────────┐ │
│  └────────────────────────────┘  │  │ Item        Qty  Price   Total │ │
│                                  │  ├────────────────────────────────┤ │
│  Categories:                     │  │ Dupatta Red   2   1,800  3,600 │ │
│  [All] [Bridal] [Fabric]         │  │ Cotton Lawn   1     850    850 │ │
│                                  │  │                                │ │
│  ┌──────┐ ┌──────┐ ┌──────┐      │  └────────────────────────────────┘ │
│  │ BRD  │ │ FAB  │ │ ACC  │      │                                      │
│  │ 001  │ │ 050  │ │ 012  │      │  Subtotal:        PKR 4,450          │
│  │85,000│ │  850 │ │18,000│      │  Discount: [10%]  PKR  -445          │
│  └──────┘ └──────┘ └──────┘      │  Tax:             PKR    0           │
│                                  │  ────────────────────────            │
│  ┌──────┐ ┌──────┐ ┌──────┐      │  TOTAL:           PKR 4,005          │
│  │ ...  │ │ ...  │ │ ...  │      │                                      │
│  └──────┘ └──────┘ └──────┘      │  Payment Method:                     │
│                                  │  [Cash] [Card] [Bank]                │
│                                  │                                      │
│                                  │  Amount Received:                    │
│                                  │  [PKR 5,000____]                     │
│                                  │                                      │
│                                  │  Change: PKR 995                     │
│                                  │                                      │
│                                  │  ┌──────────────┐ ┌────────────┐    │
│                                  │  │ [Hold Sale]  │ │ [Complete] │    │
│                                  │  └──────────────┘ └────────────┘    │
├──────────────────────────────────┴──────────────────────────────────────┤
│ Recent Sales: SAL-001 (PKR 4,500) | SAL-002 (PKR 8,200) | Today: 12   │
└─────────────────────────────────────────────────────────────────────────┘
```

### **14.4 Quick Keys**

```
F1  - New Sale
F2  - Hold Sale
F3  - Recall Held Sale
F4  - Customer Lookup
F5  - Apply Discount
F6  - Cash Payment
F7  - Card Payment
F8  - Day End Report
F9  - Calculator
F10 - Settings
F12 - Logout
```

### **14.5 Payment Split**

```
┌────────────────────────────────────────────┐
│ Split Payment                              │
├────────────────────────────────────────────┤
│ Total Amount: PKR 4,005                    │
│                                            │
│ Payment 1: Cash                            │
│ Amount: [PKR 2,000]                        │
│                                            │
│ Payment 2: Card                            │
│ Amount: [PKR 2,005]                        │
│                                            │
│ ────────────────────────────────────────── │
│ Total Paid:    PKR 4,005  ✓                │
│ Balance:       PKR     0                   │
│                                            │
│         [Cancel]  [Complete Sale]          │
└────────────────────────────────────────────┘
```

### **14.6 Day End Report**

```
┌────────────────────────────────────────────┐
│ Day End Report - 15 January 2024           │
├────────────────────────────────────────────┤
│ Cashier: Ali Hassan                        │
│ Shift: Morning (09:00 AM - 05:00 PM)       │
│                                            │
│ SALES SUMMARY                              │
│ Total Transactions:      45                │
│ Total Sales:        PKR 185,000            │
│ Total Tax:          PKR      0             │
│ Total Discount:     PKR -12,500            │
│ Net Sales:          PKR 172,500            │
│                                            │
│ PAYMENT BREAKDOWN                          │
│ Cash:               PKR 125,000            │
│ Card:               PKR  38,000            │
│ Bank Transfer:      PKR   9,500            │
│                    ─────────               │
│ Total:              PKR 172,500  ✓         │
│                                            │
│ CASH DRAWER                                │
│ Opening Balance:    PKR  10,000            │
│ Cash In:            PKR 125,000            │
│ Cash Out (Refunds): PKR  -2,000            │
│ Expected Cash:      PKR 133,000            │
│                                            │
│ Physical Count:     [PKR 133,000]          │
│ Difference:         PKR      0   ✓         │
│                                            │
│ TOP SELLING ITEMS                          │
│ 1. Cotton Lawn (28 units)                  │
│ 2. Silk Dupatta (12 units)                 │
│ 3. Wedding Shoes (8 units)                 │
│                                            │
│ Notes:                                     │
│ [_______________________________________]  │
│                                            │
│    [Print Report]  [Close Day]             │
└────────────────────────────────────────────┘
```

---

## 15. Settings Module

### **15.1 Overview**
Comprehensive system configuration with 12 categories and 127+ settings.

### **15.2 Categories**

```
1. 🏢 General (20 settings)
2. 📄 Billing & Invoicing (15 settings)
3. 📦 Inventory (12 settings)
4. 📅 Rental (18 settings)
5. 💰 Sales & Commission (10 settings)
6. 💳 Payment & Finance (14 settings)
7. 🔔 Notifications (16 settings)
8. 📦 Packing & Shipping (8 settings)
9. 📊 Tax & Compliance (6 settings)
10. 🔒 Backup & Security (5 settings)
11. 🎨 Appearance (8 settings)
12. ⚙️ Advanced (5 settings)
```

### **15.3 Settings Interface**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Settings                                               [Save All]    │
├──────────────────┬──────────────────────────────────────────────────┤
│                  │                                                  │
│ Categories       │  🏢 General Settings                             │
│                  │                                                  │
│ › 🏢 General     │  Business Information                            │
│   📄 Billing     │  • Company Name:                                 │
│   📦 Inventory   │    [Din Collection]                              │
│   📅 Rental      │                                                  │
│   💰 Sales       │  • Business Type: [Retail & Rental ▼]            │
│   💳 Payment     │                                                  │
│   🔔 Notifications│  • Tax ID/NTN:                                  │
│   📦 Shipping    │    [1234567-8]                                   │
│   📊 Tax         │                                                  │
│   🔒 Security    │  • Currency: [PKR - Pakistani Rupee ▼]           │
│   🎨 Appearance  │                                                  │
│   ⚙️ Advanced    │  • Date Format: [DD-MM-YYYY ▼]                   │
│                  │                                                  │
│                  │  • Time Format: [12 Hour ▼]                      │
│                  │                                                  │
│                  │  • Timezone: [Asia/Karachi ▼]                    │
│                  │                                                  │
│                  │  • Language: [English ▼]                         │
│                  │                                                  │
│                  │  Contact Information                             │
│                  │  • Phone: [+92-321-1234567]                      │
│                  │  • Email: [info@dincollection.com]               │
│                  │  • Website: [www.dincollection.com]              │
│                  │                                                  │
│                  │  Address                                         │
│                  │  • Street: [Main University Road]                │
│                  │  • City: [Karachi]                               │
│                  │  • State: [Sindh]                                │
│                  │  • ZIP: [75300]                                  │
│                  │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

### **15.4 Key Settings by Category**

#### **General**
- Company name, logo, business type
- Contact information
- Currency, date/time format, timezone
- Language preferences
- Fiscal year settings
- Multi-branch mode enable/disable

#### **Billing & Invoicing**
- Invoice prefix (SAL-, PUR-, RNT-)
- Auto-numbering format
- Invoice template selection
- Default payment terms
- Tax calculation method
- Due date calculation
- Invoice footer text

#### **Inventory**
- Low stock threshold (global)
- Stock alert notifications
- Auto-create PO at reorder point
- Stock valuation method (FIFO/LIFO/Average)
- Negative stock allowed
- Barcode format
- Product SKU format

#### **Rental**
- Default rental period (days)
- Security deposit (% or fixed)
- Late fee calculation (per day/hour)
- Grace period for returns (hours)
- Damage assessment required
- CNIC verification mandatory
- Rental agreement template
- Fitting appointment required

#### **Sales & Commission**
- Default commission rate (%)
- Commission calculation (on gross/net)
- Monthly target reset date
- Bonus percentage for exceeding target
- Default discount type
- Maximum discount allowed (%)
- Credit limit per customer
- Credit days allowed

#### **Payment & Finance**
- Accepted payment methods
- Default payment method
- Bank account details
- Card processing fees (%)
- Cheque clearing days
- Payment gateway integration
- Account codes for automation

#### **Notifications**
- Enable/disable by type
- Email notifications
- SMS notifications
- WhatsApp notifications
- Push notifications
- Low stock alerts
- Payment reminders
- Rental return reminders
- Sales target alerts

#### **Packing & Shipping**
- Enable packing fields
- Default thaan size (meters)
- Shipping charge calculation
- Free shipping threshold
- Default courier service
- Package weight calculation
- Dimensions required

#### **Tax & Compliance**
- Tax enabled
- Tax rate (%)
- Tax inclusive/exclusive
- GST/VAT number
- Tax report format

#### **Backup & Security**
- Auto backup enabled
- Backup frequency (daily/weekly)
- Backup location
- Data retention period (days)
- Two-factor authentication

#### **Appearance**
- Theme (Dark/Light)
- Primary color
- Accent colors by module
- Font size
- Compact mode

#### **Advanced**
- Debug mode
- API access
- Custom fields
- Import/Export formats
- Developer mode

---

## 16. State Management

### **16.1 Overview**
React Hooks-based state management with mock data backend simulation.

### **16.2 Global State Structure**

```typescript
// App.tsx - Main State Container

const App = () => {
    // Navigation
    const [currentPage, setCurrentPage] = useState<string>('dashboard');
    
    // User Session
    const [currentUser, setCurrentUser] = useState({
        id: 1,
        name: "Admin User",
        role: "admin",
        branchId: 1
    });
    
    // Mock Data States
    const [branches, setBranches] = useState(branchesMock);
    const [salesmen, setSalesmen] = useState(salesmenMock);
    const [products, setProducts] = useState(productsMock);
    const [sales, setSales] = useState(salesMock);
    const [purchases, setPurchases] = useState(purchasesMock);
    const [rentals, setRentals] = useState(rentalsMock);
    const [accounts, setAccounts] = useState(accountsMock);
    const [transactions, setTransactions] = useState(transactionsMock);
    const [expenses, setExpenses] = useState(expensesMock);
    const [settings, setSettings] = useState(settingsMock);
    
    // UI States
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    return (
        <div className="app">
            {/* Route rendering based on currentPage */}
        </div>
    );
};
```

### **16.3 Data Flow**

```
User Action (Button Click)
    ↓
Event Handler
    ↓
State Update (setState)
    ↓
Component Re-render
    ↓
UI Update (Automatic)
```

**Example: Adding a Sale**
```typescript
const handleAddSale = (saleData: Sale) => {
    // 1. Generate ID
    const newSale = {
        ...saleData,
        id: Date.now(),
        saleNumber: generateSaleNumber(),
        createdAt: new Date().toISOString()
    };
    
    // 2. Update stock
    saleData.items.forEach(item => {
        updateProductStock(item.productId, -item.qty);
    });
    
    // 3. Create accounting entries
    createSaleAccountingEntries(newSale);
    
    // 4. Update salesman sales
    updateSalesmanSales(newSale.salesmanId, newSale.totalAmount);
    
    // 5. Add to sales list
    setSales([...sales, newSale]);
    
    // 6. Show success message
    toast.success("Sale created successfully!");
    
    // 7. Navigate to sales list
    setCurrentPage('sales');
};
```

### **16.4 Mock Data Backend**

```typescript
// Simulates database operations

// CREATE
const create = (collection: string, data: any) => {
    const newRecord = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString()
    };
    
    // Add to collection
    setState(prevState => [...prevState, newRecord]);
    
    return newRecord;
};

// READ
const read = (collection: string, id?: number) => {
    if (id) {
        return state.find(item => item.id === id);
    }
    return state;
};

// UPDATE
const update = (collection: string, id: number, data: any) => {
    setState(prevState => 
        prevState.map(item => 
            item.id === id 
                ? { ...item, ...data, updatedAt: new Date().toISOString() }
                : item
        )
    );
};

// DELETE
const remove = (collection: string, id: number) => {
    setState(prevState => prevState.filter(item => item.id !== id));
};

// QUERY
const query = (collection: string, filters: any) => {
    return state.filter(item => {
        return Object.keys(filters).every(key => 
            item[key] === filters[key]
        );
    });
};
```

---

## 17. Workflows & Business Logic

### **17.1 Sale Workflow**

```
1. Create Sale (Draft)
   ↓
2. Add Customer
   ↓
3. Add Items (Search → Select → Configure → Add)
   ↓
4. Apply Discounts/Expenses
   ↓
5. Add Partial Payments
   ↓
6. Calculate Commission
   ↓
7. Update Status (Quotation → Order → Final)
   ↓
8. On Final:
   - Deduct stock
   - Create accounting entries
   - Update salesman metrics
   - Generate invoice
```

### **17.2 Purchase Workflow**

```
1. Create Purchase Order (Draft)
   ↓
2. Select Supplier
   ↓
3. Add Products
   ↓
4. Set Expected Delivery Date
   ↓
5. Update Status → Ordered
   ↓
6. On Receive:
   - Mark as Received
   - Add actual received date
   - Update status → Received
   ↓
7. On Final:
   - Add stock
   - Create accounting entries
   - Update payables
```

### **17.3 Rental Workflow**

```
1. Check Availability
   ↓
2. Create Booking (Booked)
   ↓
3. Collect Customer Info + CNIC
   ↓
4. Add Items + Set Dates
   ↓
5. Calculate Total (Rental + Deposit)
   ↓
6. Receive Payment → Confirmed
   ↓
7. Item Handover → Ongoing
   ↓
8. Item Return → Returned
   ↓
9. Inspection:
   - Check condition
   - Assess damages
   - Calculate deductions
   ↓
10. Refund Deposit → Closed
   ↓
11. Release stock for next booking
```

### **17.4 Stock Management Logic**

```typescript
// Stock Update on Sale
const updateStockOnSale = (saleItems: SaleItem[]) => {
    saleItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            const newStock = product.stock - item.qty;
            
            // Update product stock
            updateProduct(item.productId, { stock: newStock });
            
            // Log stock movement
            logStockMovement({
                productId: item.productId,
                type: 'sale',
                quantity: -item.qty,
                previousStock: product.stock,
                newStock: newStock,
                referenceType: 'sale',
                referenceId: saleId
            });
            
            // Check if low stock
            if (newStock <= product.reorderPoint) {
                createLowStockAlert(item.productId);
            }
            
            // Auto-create PO if enabled
            if (settings.autoCreatePO && newStock <= product.reorderPoint) {
                createPurchaseOrder(item.productId);
            }
        }
    });
};
```

### **17.5 Commission Calculation**

```typescript
const calculateCommission = (sale: Sale, salesman: Salesman) => {
    let commission = 0;
    
    // Base commission on subtotal
    if (sale.commissionType === 'percentage') {
        commission = (sale.subtotal * sale.commissionValue) / 100;
    } else {
        commission = sale.commissionValue;
    }
    
    // Bonus if exceeds monthly target
    const updatedSales = salesman.monthlySales + sale.subtotal;
    if (updatedSales > salesman.monthlyTarget) {
        const excess = updatedSales - salesman.monthlyTarget;
        const bonus = (excess * settings.bonusCommissionRate) / 100;
        commission += bonus;
    }
    
    return commission;
};
```

### **17.6 Payment Status Auto-Detection**

```typescript
const detectPaymentStatus = (totalAmount: number, paidAmount: number) => {
    if (paidAmount === 0) {
        return 'credit';
    } else if (paidAmount >= totalAmount) {
        return 'paid';
    } else {
        return 'partial';
    }
};
```

---

## 18. UI Components Library

### **18.1 Core Components**

All components located in `/src/app/components/ui/`

#### **Button**
```tsx
<Button variant="default" size="md">
    Default Button
</Button>

// Variants: default, outline, ghost, destructive
// Sizes: sm, md, lg
```

#### **Input**
```tsx
<Input
    type="text"
    placeholder="Enter value..."
    value={value}
    onChange={(e) => setValue(e.target.value)}
    className="bg-gray-950 border-gray-700"
/>
```

#### **Select**
```tsx
<Select value={value} onValueChange={setValue}>
    <SelectTrigger>
        <SelectValue placeholder="Select..." />
    </SelectTrigger>
    <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
    </SelectContent>
</Select>
```

#### **Table**
```tsx
<Table>
    <TableHeader>
        <TableRow>
            <TableHead>Column 1</TableHead>
            <TableHead>Column 2</TableHead>
        </TableRow>
    </TableHeader>
    <TableBody>
        <TableRow>
            <TableCell>Data 1</TableCell>
            <TableCell>Data 2</TableCell>
        </TableRow>
    </TableBody>
</Table>
```

#### **Dialog/Modal**
```tsx
<Dialog open={open} onOpenChange={setOpen}>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>Modal Title</DialogTitle>
        </DialogHeader>
        {/* Content */}
        <DialogFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
```

#### **Badge**
```tsx
<Badge className="bg-green-900/30 text-green-400">
    Active
</Badge>
```

#### **Card**
```tsx
<Card>
    <CardHeader>
        <CardTitle>Card Title</CardTitle>
    </CardHeader>
    <CardContent>
        {/* Content */}
    </CardContent>
</Card>
```

---

## 19. Summary

### **Complete System Features**

✅ **10 Major Modules**
- Branch Management
- Salesmen Management  
- Inventory Management
- Sales Management
- Purchase Management
- Accounting & Finance
- Expense Tracking
- Rental Management
- Point of Sale
- System Settings

✅ **Key Capabilities**
- Multi-branch operations
- Multi-status workflows (Draft → Quotation → Order → Final)
- Variation support (Size/Color)
- Packing support (Thaans/Meters)
- Flexible discounts & expenses
- Partial payments tracking
- Commission calculation
- Stock management with alerts
- Rental bookings with calendar
- Complete accounting (COA, Journal, Reports)
- Comprehensive settings (127+ options)

✅ **Technology Stack**
- React + TypeScript
- Tailwind CSS v4.0
- Shadcn/ui Components
- Recharts for analytics
- Motion for animations
- Mock data backend

✅ **Design System**
- Strict dark mode (#111827)
- Color-coded modules
- Professional UI
- Responsive design
- Consistent spacing & typography

---

## **Total Implementation**

```
📂 12 Module Categories
📊 127+ Configurable Settings
🎨 10 Color-Coded Modules
📋 15+ Data Models
💾 8 Core Collections (Mock DB)
🧩 50+ UI Components
📱 100% Responsive
🌙 Complete Dark Mode
```

---

**Din Collection ERP - Complete Business Management Solution!** 🎉✨

---

**End of Documentation**
