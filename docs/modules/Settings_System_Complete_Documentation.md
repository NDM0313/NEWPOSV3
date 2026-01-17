# Settings System - Complete Documentation

**Din Collection ERP - Bridal Rental Management System**

**Version:** 1.0.0  
**Last Updated:** January 5, 2026  
**Author:** Din Collection Development Team

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [General Settings](#1-general-settings)
3. [Module Management](#2-module-management)
4. [Theme & Appearance](#3-theme--appearance)
5. [Invoice Configuration](#4-invoice-configuration)
6. [Product Settings](#5-product-settings)
7. [Sales Settings](#6-sales-settings)
8. [Purchase Settings](#7-purchase-settings)
9. [Rental Settings](#8-rental-settings)
10. [Reports Settings](#9-reports-settings)
11. [Notifications](#10-notifications)
12. [Security](#11-security)
13. [Advanced Settings](#12-advanced-settings)
14. [Data Structure](#data-structure)
15. [Implementation Guide](#implementation-guide)

---

## Overview

The Settings System is a comprehensive configuration center for the Din Collection ERP system. It contains **12 major categories** with **127+ individual settings** that control every aspect of the business operations.

### Architecture

```
Settings Page
├── 12 Tabbed Categories
├── Real-time Change Detection
├── LocalStorage Persistence
├── Validation System
└── Auto-Save Warning
```

### File Location

```
/src/app/components/settings/SettingsPage.tsx
```

### Key Features

- ✅ **12 Categories** with color-coded tabs
- ✅ **127+ Settings** covering all aspects
- ✅ **Real-time Validation**
- ✅ **LocalStorage Persistence**
- ✅ **Unsaved Changes Warning**
- ✅ **Module Enable/Disable**
- ✅ **Visual Active/Inactive States**
- ✅ **Save/Reset Functionality**

---

## 1. General Settings

**Tab Color:** Blue  
**Icon:** Building2  
**Total Settings:** 14

### Purpose

Configure core business information, regional settings, and financial year parameters.

---

### 1.1 Business Information

#### Business Name *

**Type:** `string`  
**Required:** Yes  
**Default:** `"Din Collection"`  
**Max Length:** 100 characters

**Description:**  
Official registered business name that appears on invoices, reports, and system headers.

**Example:**
```typescript
businessName: "Din Collection - Bridal Couture"
```

**Usage:**
- Invoice headers
- Email signatures
- Reports headers
- System branding

---

#### Business Address

**Type:** `string` (textarea)  
**Required:** No  
**Default:** `"Main Market, Lahore, Pakistan"`  
**Max Length:** 500 characters

**Description:**  
Complete business address including street, area, city, and country.

**Example:**
```typescript
businessAddress: "Shop #123, Main Boulevard,\nGulberg III, Lahore,\nPunjab 54000, Pakistan"
```

**Usage:**
- Invoice footer
- Shipping documents
- Legal documents
- Contact information

---

#### Phone Number

**Type:** `string`  
**Format:** International format recommended  
**Default:** `"+92 300 1234567"`  
**Pattern:** `^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$`

**Description:**  
Primary business contact number with country code.

**Examples:**
```typescript
// Pakistan
businessPhone: "+92 300 1234567"

// UAE
businessPhone: "+971 50 123 4567"

// USA
businessPhone: "+1 (555) 123-4567"
```

---

#### Email Address

**Type:** `string` (email)  
**Required:** Yes  
**Default:** `"info@dincollection.com"`  
**Validation:** Valid email format

**Description:**  
Official business email for communication and notifications.

**Example:**
```typescript
businessEmail: "contact@dincollection.com"
```

**Usage:**
- Customer communications
- Report emails
- Notification sender
- Support contact

---

#### Website

**Type:** `string` (url)  
**Required:** No  
**Default:** `"www.dincollection.com"`  
**Format:** Domain or full URL

**Description:**  
Business website URL for online presence.

**Examples:**
```typescript
businessWebsite: "www.dincollection.com"
businessWebsite: "https://dincollection.com"
```

---

#### Tax ID / NTN

**Type:** `string`  
**Required:** For tax compliance  
**Default:** `"TAX-123456"`  
**Max Length:** 50 characters

**Description:**  
National Tax Number or Business Registration ID for legal compliance.

**Examples:**
```typescript
// Pakistan NTN
taxId: "1234567-8"

// UAE TRN
taxId: "100123456700003"

// US EIN
taxId: "12-3456789"
```

**Usage:**
- Tax invoices
- Legal documents
- Government filings
- Compliance reports

---

### 1.2 Regional Settings

#### Currency

**Type:** `string` (dropdown)  
**Required:** Yes  
**Default:** `"PKR"`

**Options:**
| Code | Currency | Symbol | Country |
|------|----------|--------|---------|
| `PKR` | Pakistani Rupee | ₨ | Pakistan |
| `USD` | US Dollar | $ | United States |
| `EUR` | Euro | € | European Union |
| `GBP` | British Pound | £ | United Kingdom |
| `AED` | UAE Dirham | د.إ | UAE |

**Description:**  
Primary currency for all transactions and reporting.

**Example:**
```typescript
currency: "PKR"
```

**Impact:**
- All prices displayed in this currency
- Reports generated in this currency
- Invoice amounts
- Financial calculations

---

#### Timezone

**Type:** `string` (dropdown)  
**Required:** Yes  
**Default:** `"Asia/Karachi"`

**Options:**
| Value | Description | UTC Offset |
|-------|-------------|------------|
| `Asia/Karachi` | Pakistan Standard Time | UTC+5 |
| `Asia/Dubai` | Gulf Standard Time | UTC+4 |
| `Europe/London` | Greenwich Mean Time | UTC+0 |
| `America/New_York` | Eastern Time | UTC-5 |

**Description:**  
System timezone for timestamps, reports, and scheduling.

**Example:**
```typescript
timezone: "Asia/Karachi"
```

**Usage:**
- Timestamp records
- Report generation times
- Scheduled tasks
- Backup timing

---

#### Language

**Type:** `string` (dropdown)  
**Required:** Yes  
**Default:** `"en"`

**Options:**
| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `ur` | Urdu | RTL |
| `ar` | Arabic | RTL |

**Description:**  
System interface language for labels, messages, and reports.

**Example:**
```typescript
language: "en"
```

---

### 1.3 Financial Year Configuration

#### Fiscal Year Start (MM-DD)

**Type:** `string`  
**Format:** `MM-DD`  
**Required:** Yes  
**Default:** `"01-01"`  
**Pattern:** `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`

**Description:**  
Start date of financial year for accounting and reporting purposes.

**Examples:**
```typescript
// Calendar Year (January to December)
fiscalYearStart: "01-01"

// Pakistan Fiscal Year (July to June)
fiscalYearStart: "07-01"

// UK Fiscal Year (April to March)
fiscalYearStart: "04-01"

// Custom Quarter (October to September)
fiscalYearStart: "10-01"
```

**Usage:**
- Financial reports
- Year-end calculations
- Tax periods
- Budget planning
- Profit/Loss statements

**Validation:**
- Must be valid MM-DD format
- Month: 01-12
- Day: 01-31 (based on month)

---

#### Fiscal Year End (MM-DD)

**Type:** `string`  
**Format:** `MM-DD`  
**Required:** Yes  
**Default:** `"12-31"`  
**Pattern:** `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`

**Description:**  
End date of financial year, must be 365 days after start (or 366 for leap years).

**Examples:**
```typescript
// Calendar Year End
fiscalYearEnd: "12-31"

// Pakistan Fiscal Year End
fiscalYearEnd: "06-30"

// UK Fiscal Year End
fiscalYearEnd: "03-31"
```

**Business Logic:**
```typescript
// Calculate fiscal year duration
const start = new Date(`2026-${fiscalYearStart}`);
const end = new Date(`2026-${fiscalYearEnd}`);
const duration = (end - start) / (1000 * 60 * 60 * 24);
// Should be approximately 365 days
```

**Common Fiscal Years:**

| Country | Start | End | Duration |
|---------|-------|-----|----------|
| Pakistan | 07-01 | 06-30 | 365 days |
| India | 04-01 | 03-31 | 365 days |
| UK | 04-06 | 04-05 | 365 days |
| USA | 10-01 | 09-30 | 365 days |
| Calendar | 01-01 | 12-31 | 365 days |

---

### 1.4 Display Formats

#### Date Format

**Type:** `string` (dropdown)  
**Required:** Yes  
**Default:** `"DD/MM/YYYY"`

**Options:**
| Format | Example | Common In |
|--------|---------|-----------|
| `DD/MM/YYYY` | 05/01/2026 | UK, Pakistan, Europe |
| `MM/DD/YYYY` | 01/05/2026 | USA |
| `YYYY-MM-DD` | 2026-01-05 | ISO Standard |

**Description:**  
Date display format throughout the system.

**Usage:**
- Invoices
- Reports
- Date pickers
- Exports

---

#### Time Format

**Type:** `'12h' | '24h'` (dropdown)  
**Required:** Yes  
**Default:** `"12h"`

**Options:**
| Value | Description | Example |
|-------|-------------|---------|
| `12h` | 12-hour with AM/PM | 2:30 PM |
| `24h` | 24-hour military | 14:30 |

**Description:**  
Time display format for timestamps.

**Example:**
```typescript
timeFormat: "12h"
// Displays: 2:30 PM

timeFormat: "24h"
// Displays: 14:30
```

---

#### Decimal Places

**Type:** `number`  
**Min:** 0  
**Max:** 4  
**Default:** `2`

**Description:**  
Number of decimal places for monetary amounts.

**Examples:**
```typescript
// 2 decimal places
decimalPlaces: 2
// Display: 1,234.56

// 0 decimal places (whole numbers only)
decimalPlaces: 0
// Display: 1,235

// 3 decimal places (for gold/jewelry)
decimalPlaces: 3
// Display: 1,234.567
```

**Impact:**
- All price displays
- Invoice amounts
- Report totals
- Calculations precision

---

#### Thousand Separator

**Type:** `',' | '.' | ' '` (dropdown)  
**Required:** Yes  
**Default:** `","`

**Options:**
| Value | Example | Common In |
|-------|---------|-----------|
| `,` (Comma) | 1,000,000.00 | USA, UK, Pakistan |
| `.` (Period) | 1.000.000,00 | Europe |
| ` ` (Space) | 1 000 000.00 | France, Switzerland |

**Description:**  
Character used to separate thousands in numbers.

**Examples:**
```typescript
// Comma separator
amount: 1500000
thousandSeparator: ","
// Display: 1,500,000.00

// Period separator
thousandSeparator: "."
// Display: 1.500.000,00

// Space separator
thousandSeparator: " "
// Display: 1 500 000.00
```

---

## 2. Module Management

**Tab Color:** Emerald  
**Icon:** Layers  
**Total Settings:** 8 modules

### Purpose

Enable or disable major ERP modules to customize system functionality based on business needs.

### UI Design

**Layout:** Grid of 2 columns  
**Card Style:** Interactive cards with Active/Inactive badges  
**Visual States:**
- **Active:** Colored border, glowing shadow, colored icon, green badge
- **Inactive:** Gray border, no shadow, gray icon, gray badge

---

### 2.1 POS System Module

**Key:** `enablePOSModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Purple  
**Icon:** ShoppingCart

**Description:**  
Point of Sale module for quick cash register operations and direct sales.

**Features When Enabled:**
- ✅ Quick Sale interface
- ✅ Barcode scanning
- ✅ Cash register management
- ✅ Receipt printing
- ✅ Split-screen product selection
- ✅ Multiple payment methods
- ✅ Customer selection
- ✅ Discount application

**Usage Scenario:**
Enable this module if you have a physical store with a cash counter for walk-in customers.

**Dependencies:**
- Requires Inventory Module for stock management
- Integrates with Sales Settings

**Sidebar Entry:**
```
🛒 POS System
```

**Route:**
```
/pos
```

---

### 2.2 Inventory Management Module

**Key:** `enableInventoryModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Blue  
**Icon:** Package

**Description:**  
Complete stock and warehouse management system with real-time inventory tracking.

**Features When Enabled:**
- ✅ Stock management
- ✅ Warehouse locations
- ✅ Stock transfers
- ✅ Low stock alerts
- ✅ Product variants
- ✅ Batch tracking
- ✅ Serial number tracking
- ✅ Stock adjustments
- ✅ Inventory reports

**Usage Scenario:**
Essential for businesses that need to track product quantities, locations, and movements.

**Dependencies:**
- Required by POS Module
- Required by Sales Module
- Integrates with Purchase Module

**Sidebar Entry:**
```
📦 Inventory
```

**Routes:**
```
/inventory
/inventory/add
/inventory/edit/:id
```

---

### 2.3 Rental Management Module

**Key:** `enableRentalModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Teal  
**Icon:** Archive

**Description:**  
Specialized module for managing rental items, bookings, returns, and late fees.

**Features When Enabled:**
- ✅ Rental bookings
- ✅ Item availability calendar
- ✅ Security deposits
- ✅ Late fee calculation
- ✅ Damage assessment
- ✅ Return management
- ✅ Rental reminders
- ✅ Customer rental history

**Usage Scenario:**
Critical for bridal wear rental business. Track dress/jewelry rentals, due dates, and returns.

**Business Logic:**
```typescript
interface RentalBooking {
  itemId: string;
  customerId: string;
  rentalDate: Date;
  returnDate: Date;
  securityDeposit: number;
  rentalFee: number;
  lateFeePerDay: number;
  status: 'booked' | 'active' | 'returned' | 'overdue';
}
```

**Sidebar Entry:**
```
📦 Rentals
```

**Routes:**
```
/rentals
/rentals/book
/rentals/return
```

---

### 2.4 Customize Studio Module

**Key:** `enableCustomizeModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Pink  
**Icon:** Palette

**Description:**  
Custom fabric workflow management for bespoke orders and customizations.

**Features When Enabled:**
- ✅ Custom order forms
- ✅ Fabric selection
- ✅ Measurement recording
- ✅ Design specifications
- ✅ Color/pattern selection
- ✅ Progress tracking
- ✅ Customer approvals
- ✅ Delivery scheduling

**Usage Scenario:**
For businesses offering custom-tailored bridal wear or made-to-order products.

**Workflow:**
```
Fabric Sale → Measurements → Design → Production → Delivery
```

**Sidebar Entry:**
```
🎨 Customize
```

**Routes:**
```
/customize
/customize/orders
```

---

### 2.5 Studio Production Module

**Key:** `enableStudioModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Orange  
**Icon:** Building2

**Description:**  
Full production workflow management with multi-department tracking.

**Features When Enabled:**
- ✅ Multi-phase production pipeline
- ✅ Department assignments
- ✅ Task management
- ✅ Quality control checkpoints
- ✅ Production timeline
- ✅ Work-in-progress tracking
- ✅ Staff assignments
- ✅ Production reports

**Production Phases:**
1. **Cutting** - Fabric cutting department
2. **Stitching** - Sewing and assembly
3. **Embroidery** - Decorative work
4. **Finishing** - Final touches and quality check
5. **Packing** - Packaging and delivery prep

**Usage Scenario:**
For businesses with in-house production facilities and multiple departments.

**Sidebar Entry:**
```
🏭 Studio
```

**Routes:**
```
/studio
/studio/workflow
/studio/departments
```

---

### 2.6 Accounting Module

**Key:** `enableAccountingModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Green  
**Icon:** DollarSign

**Description:**  
Financial accounts management, ledgers, and double-entry bookkeeping.

**Features When Enabled:**
- ✅ Chart of accounts
- ✅ Journal entries
- ✅ Ledger management
- ✅ Trial balance
- ✅ Profit & Loss
- ✅ Balance sheet
- ✅ Cash flow statements
- ✅ Bank reconciliation

**Usage Scenario:**
For businesses needing full accounting capabilities beyond basic sales tracking.

**Account Types:**
- Assets
- Liabilities
- Equity
- Revenue
- Expenses

**Sidebar Entry:**
```
💰 Accounting
```

**Routes:**
```
/accounting
/accounting/accounts
/accounting/ledger
/accounting/reports
```

---

### 2.7 Expenses Management Module

**Key:** `enableExpensesModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Red  
**Icon:** Receipt

**Description:**  
Track and categorize all business expenses with receipt management.

**Features When Enabled:**
- ✅ Expense recording
- ✅ Category management
- ✅ Vendor tracking
- ✅ Receipt attachments
- ✅ Approval workflows
- ✅ Budget tracking
- ✅ Expense reports
- ✅ Tax deduction tracking

**Expense Categories:**
- Rent & Utilities
- Salaries & Wages
- Marketing & Advertising
- Travel & Transportation
- Office Supplies
- Raw Materials
- Equipment & Machinery
- Professional Services

**Usage Scenario:**
Essential for tracking overhead costs and profitability analysis.

**Sidebar Entry:**
```
🧾 Expenses
```

**Routes:**
```
/expenses
/expenses/add
/expenses/categories
/expenses/reports
```

---

### 2.8 Reports & Analytics Module

**Key:** `enableReportsModule`  
**Type:** `boolean`  
**Default:** `true`  
**Color:** Yellow  
**Icon:** PieChart

**Description:**  
Business intelligence, reports, and data visualization.

**Features When Enabled:**
- ✅ Sales reports
- ✅ Inventory reports
- ✅ Financial reports
- ✅ Customer analytics
- ✅ Product performance
- ✅ Trend analysis
- ✅ Export capabilities (PDF, Excel, CSV)
- ✅ Custom date ranges

**Report Types:**
- Daily Sales Summary
- Monthly Revenue
- Inventory Valuation
- Top Selling Products
- Customer Purchase History
- Profit Margins
- Expense Analysis
- Rental Performance

**Sidebar Entry:**
```
📊 Reports
```

**Routes:**
```
/reports
/reports/sales
/reports/inventory
/reports/financial
```

---

### Module Status Summary

**Live Counter Display:**
```
┌─────────────────────────────────────────┐
│ ✓ Module Status Summary                │
│ 8 of 8 modules are currently active    │
└─────────────────────────────────────────┘
```

**Calculation:**
```typescript
const activeModules = [
  settings.enablePOSModule,
  settings.enableInventoryModule,
  settings.enableRentalModule,
  settings.enableCustomizeModule,
  settings.enableStudioModule,
  settings.enableAccountingModule,
  settings.enableExpensesModule,
  settings.enableReportsModule
].filter(Boolean).length;

// Display: `${activeModules} of 8 modules are currently active`
```

---

## 3. Theme & Appearance

**Tab Color:** Purple  
**Icon:** Palette  
**Total Settings:** 9

### Purpose

Customize the visual appearance and branding of the ERP system.

---

### 3.1 Color Scheme

#### Primary Color

**Type:** `string` (color picker)  
**Format:** Hex color code  
**Default:** `"#9333EA"` (Purple)

**Description:**  
Main accent color used throughout the system for primary actions and highlights.

**Usage:**
- Primary buttons
- Active tab indicators
- Important badges
- Links
- Icons highlights

**Examples:**
```typescript
primaryColor: "#9333EA"  // Purple (Default)
primaryColor: "#3B82F6"  // Blue
primaryColor: "#EF4444"  // Red
primaryColor: "#10B981"  // Green
```

---

#### Secondary Color

**Type:** `string` (color picker)  
**Format:** Hex color code  
**Default:** `"#3B82F6"` (Blue)

**Description:**  
Supporting color for secondary elements and information.

**Usage:**
- Secondary buttons
- Info badges
- Supporting icons
- Alternative highlights

---

#### Accent Color

**Type:** `string` (color picker)  
**Format:** Hex color code  
**Default:** `"#10B981"` (Green)

**Description:**  
Accent color for success states and positive actions.

**Usage:**
- Success messages
- Confirmation buttons
- Positive indicators
- Active status badges

---

### 3.2 Branding

#### Logo URL

**Type:** `string` (url)  
**Format:** Image URL (PNG, JPG, SVG)  
**Default:** `""` (empty)  
**Max File Size:** 2MB recommended  
**Dimensions:** 200x60px recommended

**Description:**  
Company logo displayed in system header and invoices.

**Examples:**
```typescript
logoUrl: "https://cdn.dincollection.com/logo.png"
logoUrl: "/assets/images/company-logo.svg"
```

**Usage:**
- System header/sidebar
- Invoice headers
- Reports headers
- Email signatures

---

### 3.3 Layout Options

#### Sidebar Position

**Type:** `'left' | 'right'` (dropdown)  
**Default:** `"left"`

**Options:**
| Value | Description |
|-------|-------------|
| `left` | Sidebar on left side (standard) |
| `right` | Sidebar on right side (RTL friendly) |

**Description:**  
Position of main navigation sidebar.

**Usage:**
- RTL language support (Arabic, Urdu)
- User preference
- Screen layout optimization

---

### 3.4 Display Preferences

#### Dark Mode

**Type:** `boolean` (toggle)  
**Default:** `true`  
**Badge:** "Recommended"

**Description:**  
Enable dark color scheme for reduced eye strain.

**Current State:**
```typescript
darkMode: true
// System uses dark theme (#111827 background)
```

**Colors:**
- **Dark Mode:** Background `#111827`, Text `#FFFFFF`
- **Light Mode:** Background `#FFFFFF`, Text `#111827`

---

#### Compact Mode

**Type:** `boolean` (toggle)  
**Default:** `false`

**Description:**  
Reduce spacing and padding to show more content on screen.

**Effect:**
```typescript
compactMode: false
// Padding: 6 (default)

compactMode: true
// Padding: 4 (reduced by 33%)
```

---

#### Show Breadcrumbs

**Type:** `boolean` (toggle)  
**Default:** `true`

**Description:**  
Display navigation breadcrumb trail at top of pages.

**Example:**
```
Home > Inventory > Add Product
```

---

#### Enable Animations

**Type:** `boolean` (toggle)  
**Default:** `true`

**Description:**  
Enable smooth transitions and animations throughout the system.

**Effects:**
- Fade transitions
- Slide animations
- Hover effects
- Loading animations

**Performance Note:**  
Disable on slower devices for better performance.

---

## 4. Invoice Configuration

**Tab Color:** Green  
**Icon:** FileText  
**Total Settings:** 11

### Purpose

Configure invoice generation, numbering, and appearance.

---

### 4.1 Invoice Numbering

#### Invoice Prefix

**Type:** `string`  
**Max Length:** 10  
**Default:** `"INV"`  
**Pattern:** `^[A-Z0-9-]+$`

**Description:**  
Prefix added before invoice number.

**Examples:**
```typescript
invoicePrefix: "INV"
// Generated: INV-2026-0001

invoicePrefix: "SALE"
// Generated: SALE-2026-0001

invoicePrefix: "DC"
// Generated: DC-2026-0001
```

---

#### Invoice Number Format

**Type:** `string` (dropdown)  
**Default:** `"YYYY-NNNN"`

**Options:**
| Format | Example | Description |
|--------|---------|-------------|
| `YYYY-NNNN` | 2026-0001 | Year-4DigitNumber |
| `NNNN` | 0001 | SimpleSerial |
| `YYMM-NNN` | 2601-001 | YearMonth-Serial |
| `YYYYMMDD-NN` | 20260105-01 | FullDate-Serial |

**Description:**  
Structure of invoice number after prefix.

**Full Invoice Number:**
```typescript
const fullInvoiceNumber = `${invoicePrefix}-${format}`;

// Example: INV-2026-0001
```

---

#### Starting Number

**Type:** `number`  
**Min:** 1  
**Default:** `1`

**Description:**  
First invoice number to start sequence from.

**Examples:**
```typescript
invoiceStartNumber: 1
// First invoice: INV-2026-0001

invoiceStartNumber: 1000
// First invoice: INV-2026-1000
```

**Auto-Increment:**
```typescript
const nextInvoiceNumber = currentNumber + 1;
```

---

### 4.2 Invoice Appearance

#### Template Style

**Type:** `'modern' | 'classic' | 'minimal'` (dropdown)  
**Default:** `"modern"`

**Options:**

**Modern:**
- Clean layout
- Card-based design
- Color accents
- Modern fonts

**Classic:**
- Traditional layout
- Border frames
- Formal appearance
- Serif fonts

**Minimal:**
- Simple layout
- No borders
- Monochrome
- Sans-serif fonts

---

#### Logo Position

**Type:** `'left' | 'center' | 'right'` (dropdown)  
**Default:** `"left"`

**Description:**  
Position of company logo on invoice header.

---

#### Payment Due Days

**Type:** `number`  
**Min:** 0  
**Max:** 365  
**Default:** `30`

**Description:**  
Default number of days for payment to be due.

**Calculation:**
```typescript
const dueDate = new Date(invoiceDate);
dueDate.setDate(dueDate.getDate() + invoiceDueDays);
```

**Example:**
```typescript
invoiceDueDays: 30
// Invoice Date: 2026-01-05
// Due Date: 2026-02-04
```

---

#### Watermark Text

**Type:** `string`  
**Optional:** Yes  
**Max Length:** 50  
**Default:** `""`

**Description:**  
Text displayed as diagonal watermark on invoice.

**Examples:**
```typescript
invoiceWatermark: "PAID"
invoiceWatermark: "DRAFT"
invoiceWatermark: "CONFIDENTIAL"
invoiceWatermark: "COPY"
```

---

### 4.3 Invoice Content

#### Invoice Terms & Conditions

**Type:** `string` (textarea)  
**Max Length:** 1000  
**Default:** `"Payment due within 30 days"`

**Description:**  
Terms and conditions displayed on invoice footer.

**Example:**
```typescript
invoiceTerms: `1. Payment due within 30 days
2. Late payment subject to 2% monthly interest
3. Goods remain property of seller until paid
4. No refunds on custom orders`
```

---

#### Invoice Footer Text

**Type:** `string`  
**Max Length:** 200  
**Default:** `"Thank you for your business!"`

**Description:**  
Footer message on invoice.

**Examples:**
```typescript
invoiceFooter: "Thank you for your business!"
invoiceFooter: "We appreciate your patronage"
invoiceFooter: "Visit us at www.dincollection.com"
```

---

### 4.4 Display Options

#### Show Tax on Invoice

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Display tax breakdown on invoice.

**When Enabled:**
```
Subtotal:     50,000
Tax (17%):     8,500
Total:        58,500
```

---

#### Show Discount on Invoice

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Display discount line on invoice.

**When Enabled:**
```
Subtotal:     50,000
Discount (10%): -5,000
Tax (17%):     7,650
Total:        52,650
```

---

## 5. Product Settings

**Tab Color:** Orange  
**Icon:** Package  
**Total Settings:** 13

### Purpose

Configure product management, SKU generation, and inventory tracking options.

---

### 5.1 Product Identification

#### SKU Format

**Type:** `string`  
**Default:** `"PRD-NNNN"`  
**Pattern:** Use `NNNN` for auto-number placeholder

**Description:**  
Template for automatic SKU generation.

**Examples:**
```typescript
skuFormat: "PRD-NNNN"
// Generated: PRD-0001, PRD-0002, ...

skuFormat: "DC-YYYY-NNNN"
// Generated: DC-2026-0001, DC-2026-0002, ...

skuFormat: "ITEM-NNN"
// Generated: ITEM-001, ITEM-002, ...
```

---

#### Auto-Generate SKU

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Automatically generate SKU when creating new products.

**When Enabled:**
```typescript
// System generates SKU automatically
const newSKU = generateSKU(skuFormat);
```

**When Disabled:**
```typescript
// User must manually enter SKU
```

---

#### Product Code Prefix

**Type:** `string`  
**Max Length:** 10  
**Default:** `"PRD"`

**Description:**  
Default prefix for product codes.

---

### 5.2 Inventory Tracking

#### Low Stock Threshold

**Type:** `number`  
**Min:** 0  
**Max:** 1000  
**Default:** `10`

**Description:**  
Quantity level that triggers low stock alert.

**Business Logic:**
```typescript
if (product.quantity <= lowStockThreshold) {
  sendLowStockAlert(product);
  showWarning("Low Stock Alert");
}
```

**Example:**
```typescript
lowStockThreshold: 10

// Product A: Qty 8  → ⚠️ LOW STOCK
// Product B: Qty 15 → ✅ OK
```

---

### 5.3 Barcode System

#### Enable Barcode

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Enable barcode scanning and generation.

---

#### Barcode Format

**Type:** `'CODE128' | 'EAN13' | 'QR'` (dropdown)  
**Default:** `"CODE128"`

**Options:**

**CODE128:**
- General purpose
- Alphanumeric support
- Variable length
- Most common

**EAN13:**
- International standard
- 13 digits
- Retail products
- Global recognition

**QR Code:**
- 2D barcode
- Large data capacity
- Mobile friendly
- Modern solution

---

### 5.4 Product Units

#### Default Product Unit

**Type:** `string` (dropdown)  
**Default:** `"piece"`

**Options:**
| Value | Description | Use Case |
|-------|-------------|----------|
| `piece` | Individual items | Dresses, accessories |
| `meter` | Length measurement | Fabric, ribbons |
| `kg` | Weight | Beads, sequins |
| `liter` | Volume | Liquids, dyes |
| `box` | Package | Bulk items |
| `set` | Sets/bundles | Jewelry sets |

---

### 5.5 Advanced Features

#### Enable Product Variants

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Support for product variations (size, color, material).

**Example:**
```typescript
// Wedding Dress
Product: "Elegant Bridal Gown"
Variants:
  - Size S, Color White
  - Size M, Color White
  - Size M, Color Ivory
  - Size L, Color Ivory
```

---

#### Enable Product Expiry

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Track expiry dates for perishable products.

**Use Cases:**
- Cosmetics
- Adhesives
- Chemicals
- Food items

---

#### Enable Product Images

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Allow multiple images per product.

---

#### Max Product Images

**Type:** `number`  
**Min:** 1  
**Max:** 10  
**Default:** `5`

**Description:**  
Maximum number of images allowed per product.

---

#### Track Serial Numbers

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Track individual items by unique serial numbers.

**Use Cases:**
- High-value items
- Jewelry pieces
- Electronic equipment
- Warranty tracking

---

#### Enable Batch Tracking

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Track products by batch/lot numbers.

**Use Cases:**
- Fabric batches
- Manufacturing lots
- Quality control
- Recall management

---

## 6. Sales Settings

**Tab Color:** Pink  
**Icon:** ShoppingCart  
**Total Settings:** 20

### Purpose

Configure sales process, pricing, discounts, and customer management.

---

### 6.1 Pricing & Tax

#### Default Tax Rate (%)

**Type:** `number`  
**Min:** 0  
**Max:** 100  
**Default:** `17`  
**Decimal Places:** 2

**Description:**  
Default tax percentage applied to sales.

**Examples:**
```typescript
// Pakistan GST
defaultTaxRate: 17

// UAE VAT
defaultTaxRate: 5

// No tax
defaultTaxRate: 0
```

**Calculation:**
```typescript
const subtotal = 50000;
const taxAmount = subtotal * (defaultTaxRate / 100);
const total = subtotal + taxAmount;

// 50,000 + (50,000 × 0.17) = 58,500
```

---

#### Enable Multiple Tax Rates

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Allow different tax rates for different products.

**When Enabled:**
```typescript
Product A: Tax Rate 17%
Product B: Tax Rate 5%
Product C: Tax Rate 0% (Exempt)
```

---

#### Max Discount Allowed (%)

**Type:** `number`  
**Min:** 0  
**Max:** 100  
**Default:** `50`

**Description:**  
Maximum discount percentage allowed on sales.

**Validation:**
```typescript
if (discountPercent > maxDiscountPercent) {
  throw new Error(`Discount cannot exceed ${maxDiscountPercent}%`);
}
```

**Example:**
```typescript
maxDiscountPercent: 50

// Allowed: 10%, 20%, 50%
// Blocked: 60%, 80%, 100%
```

---

### 6.2 Sales Process

#### Require Customer for Sale

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Make customer selection mandatory for every sale.

**When Enabled:**
```typescript
// Cannot save sale without customer
if (!sale.customerId) {
  throw new Error("Customer is required");
}
```

---

#### Allow Negative Stock

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Allow sales even when stock quantity is insufficient.

**When Disabled (Recommended):**
```typescript
if (product.quantity < saleQuantity) {
  throw new Error("Insufficient stock");
}
```

**When Enabled:**
```typescript
// Sale proceeds, quantity becomes negative
product.quantity = 5;
saleQuantity = 8;
// Final quantity: -3
```

---

### 6.3 Payment Options

#### Default Payment Method

**Type:** `string` (dropdown)  
**Default:** `"cash"`

**Options:**
| Value | Description |
|-------|-------------|
| `cash` | Cash payment |
| `card` | Credit/Debit card |
| `bank_transfer` | Bank transfer |
| `online` | Online payment gateway |

**Description:**  
Pre-selected payment method on POS/Sales form.

---

#### Auto-Print Receipt

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Automatically print receipt after sale completion.

---

### 6.4 ⭐ Duplicate Item Behavior

**Type:** `'increase_quantity' | 'add_new_row'` (dropdown)  
**Default:** `"increase_quantity"`  
**Highlighted:** Yes (Purple border)

**Description:**  
**CRITICAL SETTING** - Defines behavior when same item is added multiple times to a sale.

**Options:**

#### Option 1: Increase Quantity (Merge Rows)

**Value:** `increase_quantity`

**Behavior:**
```typescript
// Current cart
Cart: [
  { id: 1, product: "Wedding Dress", qty: 1, price: 50000 }
]

// User adds same product again
addToCart("Wedding Dress")

// Result: Quantity increases
Cart: [
  { id: 1, product: "Wedding Dress", qty: 2, price: 50000 }
]
```

**Pros:**
- ✅ Cleaner cart view
- ✅ Single line per product
- ✅ Easy quantity management
- ✅ Standard retail behavior

**Cons:**
- ❌ Cannot have different prices for same item
- ❌ Cannot have different discounts per item

**Use Case:**
Standard retail where same product = same price

---

#### Option 2: Add New Row (Separate Lines)

**Value:** `add_new_row`

**Behavior:**
```typescript
// Current cart
Cart: [
  { id: 1, product: "Wedding Dress", qty: 1, price: 50000 }
]

// User adds same product again
addToCart("Wedding Dress")

// Result: New separate row
Cart: [
  { id: 1, product: "Wedding Dress", qty: 1, price: 50000 },
  { id: 2, product: "Wedding Dress", qty: 1, price: 50000 }
]
```

**Pros:**
- ✅ Different prices possible for same item
- ✅ Individual discounts per line
- ✅ Flexible pricing
- ✅ Detailed tracking

**Cons:**
- ❌ Multiple lines for same product
- ❌ Cart looks longer
- ❌ Need to manage duplicates

**Use Case:**
Rental business where same dress can have different rental rates or terms

---

**Implementation:**
```typescript
const addToCart = (product) => {
  if (settings.duplicateItemBehavior === 'increase_quantity') {
    // Find existing item
    const existing = cart.find(item => item.productId === product.id);
    
    if (existing) {
      // Increase quantity
      existing.quantity += 1;
    } else {
      // Add new item
      cart.push({ ...product, quantity: 1 });
    }
  } else {
    // Always add new row
    cart.push({ ...product, quantity: 1, uniqueId: generateId() });
  }
};
```

---

### 6.5 Sales Workflow

#### Auto-Save Interval (seconds)

**Type:** `number`  
**Min:** 10  
**Max:** 300  
**Default:** `30`

**Description:**  
Automatically save draft sales every N seconds.

**Example:**
```typescript
autoSaveInterval: 30

// Auto-save triggers every 30 seconds
setInterval(() => {
  saveSaleDraft();
}, autoSaveInterval * 1000);
```

---

#### Enable Quick Sale Mode

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Enable simplified POS interface for fast transactions.

---

#### Show Stock in Sale

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Display available quantity during product selection.

**When Enabled:**
```
Product: Wedding Dress #123
Price: 50,000
Stock: 3 available ✅
```

---

#### Require Sale Approval

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Sales require manager approval before finalization.

---

#### Minimum Sale Amount

**Type:** `number`  
**Min:** 0  
**Default:** `0`

**Description:**  
Minimum transaction value for a sale.

**Validation:**
```typescript
if (saleTotal < minimumSaleAmount) {
  throw new Error(`Minimum sale amount is ${minimumSaleAmount}`);
}
```

---

### 6.6 Customer Credit

#### Enable Customer Credit

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Allow sales on credit (pay later).

---

#### Credit Limit

**Type:** `number`  
**Min:** 0  
**Default:** `50000`

**Description:**  
Maximum credit amount allowed per customer.

**Business Logic:**
```typescript
const customerOutstanding = getCustomerOutstanding(customerId);
const creditAvailable = creditLimit - customerOutstanding;

if (saleTotal > creditAvailable) {
  throw new Error("Credit limit exceeded");
}
```

---

### 6.7 Loyalty System

#### Enable Loyalty Points

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Reward customers with points on purchases.

---

#### Points Per Currency

**Type:** `number`  
**Min:** 0  
**Step:** 0.1  
**Default:** `1`

**Description:**  
How many points earned per currency unit spent.

**Example:**
```typescript
pointsPerCurrency: 1

// Purchase: 50,000
// Points earned: 50,000 × 1 = 50,000 points

pointsPerCurrency: 0.01

// Purchase: 50,000
// Points earned: 50,000 × 0.01 = 500 points
```

---

### 6.8 Returns

#### Enable Sale Returns

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Allow customers to return purchased items.

---

#### Return Days Limit

**Type:** `number`  
**Min:** 1  
**Max:** 90  
**Default:** `7`

**Description:**  
Number of days within which returns are accepted.

**Validation:**
```typescript
const daysSincePurchase = (today - saleDate) / (1000 * 60 * 60 * 24);

if (daysSincePurchase > returnDaysLimit) {
  throw new Error("Return period expired");
}
```

---

## 7. Purchase Settings

**Tab Color:** Indigo  
**Icon:** Truck  
**Total Settings:** 9

### Purpose

Configure purchase orders, vendor management, and procurement workflow.

---

### 7.1 Purchase Orders

#### Purchase Order Prefix

**Type:** `string`  
**Max Length:** 10  
**Default:** `"PO"`

**Description:**  
Prefix for purchase order numbers.

**Example:**
```typescript
purchaseOrderPrefix: "PO"
// Generated: PO-2026-0001
```

---

#### Default Purchase Tax (%)

**Type:** `number`  
**Min:** 0  
**Max:** 100  
**Default:** `17`

**Description:**  
Default tax rate for purchases.

---

### 7.2 Approval Workflow

#### Require Purchase Approval

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Purchase orders need approval before processing.

---

#### Purchase Approval Amount

**Type:** `number`  
**Min:** 0  
**Default:** `100000`

**Description:**  
Purchase amount threshold requiring approval.

**Business Logic:**
```typescript
if (purchaseTotal > purchaseApprovalAmount) {
  status = 'pending_approval';
  requireManagerApproval();
} else {
  status = 'approved';
  processPurchase();
}
```

**Example:**
```typescript
purchaseApprovalAmount: 100000

// Purchase A: 50,000  → Auto-approved
// Purchase B: 150,000 → Needs approval
```

---

### 7.3 Returns & Quality

#### Enable Purchase Return

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Allow returning items to vendor.

---

#### Enable Quality Check

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Mandatory quality inspection on received goods.

**Workflow:**
```
Order → Receive → Quality Check → Accept/Reject
```

---

### 7.4 Vendor Management

#### Enable Vendor Rating

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Rate vendors based on performance.

**Rating Factors:**
- Quality of goods
- Delivery time
- Pricing
- Communication

---

### 7.5 GRN (Goods Received Note)

#### Enable GRN

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Generate Goods Received Note on delivery.

---

#### GRN Prefix

**Type:** `string`  
**Max Length:** 10  
**Default:** `"GRN"`

**Description:**  
Prefix for GRN numbers.

**Example:**
```typescript
grnPrefix: "GRN"
// Generated: GRN-2026-0001
```

---

## 8. Rental Settings

**Tab Color:** Teal  
**Icon:** Archive  
**Total Settings:** 9

### Purpose

Configure rental business parameters, fees, and return policies.

---

### 8.1 Rental Numbering

#### Rental Prefix

**Type:** `string`  
**Max Length:** 10  
**Default:** `"RNT"`

**Description:**  
Prefix for rental booking numbers.

---

### 8.2 Rental Terms

#### Default Rental Duration (days)

**Type:** `number`  
**Min:** 1  
**Max:** 365  
**Default:** `3`

**Description:**  
Default number of days for rental period.

**Example:**
```typescript
defaultRentalDuration: 3

// Rental Date: 2026-01-05
// Return Date: 2026-01-08
```

---

#### Late Fee Per Day

**Type:** `number`  
**Min:** 0  
**Default:** `500`

**Description:**  
Daily charge for late returns.

**Calculation:**
```typescript
const daysLate = Math.max(0, actualReturn - expectedReturn);
const lateFee = daysLate * lateFeePerDay;
```

**Example:**
```typescript
lateFeePerDay: 500

// Expected return: 2026-01-08
// Actual return: 2026-01-10
// Days late: 2
// Late fee: 2 × 500 = 1,000
```

---

#### Security Deposit (%)

**Type:** `number`  
**Min:** 0  
**Max:** 100  
**Default:** `20`

**Description:**  
Percentage of rental fee collected as security deposit.

**Calculation:**
```typescript
const rentalFee = 10000;
const depositAmount = rentalFee * (securityDepositPercent / 100);
// 10,000 × 0.20 = 2,000
```

---

### 8.3 Reminders

#### Enable Rental Reminders

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Send return reminders to customers.

---

#### Reminder Days Before

**Type:** `number`  
**Min:** 1  
**Max:** 7  
**Default:** `1`

**Description:**  
Send reminder N days before return date.

**Example:**
```typescript
reminderDaysBefore: 1

// Return date: 2026-01-08
// Reminder sent: 2026-01-07
```

---

### 8.4 Damage Management

#### Enable Damage Charges

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Charge customers for damaged items.

---

#### Damage Assessment Required

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Mandatory inspection on return to assess damage.

**Workflow:**
```
Return → Inspect → Assess Damage → Calculate Charges
```

---

#### Auto-Calculate Late Fee

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Automatically calculate and apply late fees.

**When Enabled:**
```typescript
// Automatic
if (returnDate > expectedReturnDate) {
  const lateFee = calculateLateFee(daysLate);
  rental.additionalCharges += lateFee;
}
```

---

## 9. Reports Settings

**Tab Color:** Yellow  
**Icon:** PieChart  
**Total Settings:** 9

### Purpose

Configure report generation, formats, and export options.

---

### 9.1 Report Formats

#### Report Date Format

**Type:** `string` (dropdown)  
**Default:** `"DD/MM/YYYY"`

**Options:**
- DD/MM/YYYY
- MM/DD/YYYY
- YYYY-MM-DD

---

#### Report Currency

**Type:** `string` (dropdown)  
**Default:** `"PKR"`

**Options:**
- PKR
- USD
- EUR
- GBP
- AED

---

### 9.2 Default Settings

#### Default Report Period

**Type:** `'week' | 'month' | 'quarter' | 'year'` (dropdown)  
**Default:** `"month"`

**Options:**
| Value | Description | Range |
|-------|-------------|-------|
| `week` | Current week | Monday - Sunday |
| `month` | Current month | 1st - Last day |
| `quarter` | Current quarter | 3 months |
| `year` | Current year | Jan - Dec |

---

### 9.3 Automated Reports

#### Enable Auto Reports

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Automatically generate and email reports.

---

#### Report Email Frequency

**Type:** `'daily' | 'weekly' | 'monthly'` (dropdown)  
**Default:** `"weekly"`

**Description:**  
How often auto-generated reports are sent.

---

### 9.4 Report Features

#### Include Graphs in Reports

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Include charts and visualizations in reports.

---

### 9.5 Export Options

#### Enable Export to PDF

**Type:** `boolean`  
**Default:** `true`

---

#### Enable Export to Excel

**Type:** `boolean`  
**Default:** `true`

---

#### Enable Export to CSV

**Type:** `boolean`  
**Default:** `true`

---

## 10. Notifications

**Tab Color:** Red  
**Icon:** Bell  
**Total Settings:** 9

### Purpose

Configure notification channels and alert types.

---

### 10.1 Channels

#### Email Notifications

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Send notifications via email.

---

#### SMS Notifications

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Send notifications via SMS.

---

### 10.2 Alert Types

#### Low Stock Alert

**Type:** `boolean`  
**Default:** `true`

**Triggers:**
```typescript
if (product.quantity <= lowStockThreshold) {
  sendNotification({
    type: 'low_stock',
    message: `${product.name} is low on stock (${product.quantity})`
  });
}
```

---

#### Payment Due Alert

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Notify when customer payment is due.

---

#### Rental Return Alert

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Remind customers about rental returns.

---

#### Product Expiry Alert

**Type:** `boolean`  
**Default:** `true`

---

#### Expiry Alert Days

**Type:** `number`  
**Min:** 1  
**Max:** 90  
**Default:** `30`

**Description:**  
Alert N days before product expires.

---

#### Order Status Notification

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Notify on order status changes.

---

#### Daily Sales Summary

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Daily email with sales summary.

---

## 11. Security

**Tab Color:** Cyan  
**Icon:** Shield  
**Total Settings:** 9

### Purpose

Configure security policies, authentication, and access control.

---

### 11.1 Session Management

#### Session Timeout (minutes)

**Type:** `number`  
**Min:** 5  
**Max:** 1440  
**Default:** `30`

**Description:**  
Auto-logout after N minutes of inactivity.

---

### 11.2 Authentication

#### Two-Factor Authentication

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Require 2FA for login.

---

#### Password Policy

**Type:** `'weak' | 'medium' | 'strong'` (dropdown)  
**Default:** `"medium"`

**Options:**

**Weak:**
- Minimum 6 characters
- No special requirements

**Medium:**
- Minimum 8 characters
- Mixed case required
- At least 1 number

**Strong:**
- Minimum 12 characters
- Mixed case required
- Numbers required
- Special characters required
- Password expiry: 90 days

---

#### Max Login Attempts

**Type:** `number`  
**Min:** 3  
**Max:** 10  
**Default:** `5`

**Description:**  
Lock account after N failed login attempts.

---

#### Lockout Duration (minutes)

**Type:** `number`  
**Min:** 5  
**Max:** 60  
**Default:** `15`

**Description:**  
How long account stays locked.

---

#### Require Email Verification

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Users must verify email to activate account.

---

### 11.3 Access Control

#### Enable Role-Based Access

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Restrict features based on user roles.

**Roles:**
- Admin
- Manager
- Sales Staff
- Inventory Staff
- Accountant

---

### 11.4 Audit & Monitoring

#### Enable Audit Log

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Track all user actions in system.

**Logged Actions:**
- Login/Logout
- Sales transactions
- Inventory changes
- Settings changes
- Data exports

---

#### IP Whitelist

**Type:** `string` (textarea)  
**Format:** Comma-separated IPs  
**Optional:** Yes

**Description:**  
Allow access only from specified IP addresses.

**Example:**
```typescript
ipWhitelist: "192.168.1.1, 192.168.1.100, 203.0.113.0"
```

---

## 12. Advanced Settings

**Tab Color:** Gray  
**Icon:** Database  
**Total Settings:** 12

### Purpose

Configure advanced system features, integrations, and performance options.

---

### 12.1 API Configuration

#### Enable API Access

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Enable REST API for external integrations.

---

#### API Key

**Type:** `string` (password)  
**Max Length:** 100  
**Optional:** Yes

**Description:**  
API authentication key.

**Generate:**
```typescript
const apiKey = generateSecureKey(64);
// Example: "sk_live_51H..."
```

---

#### Webhook URL

**Type:** `string` (url)  
**Optional:** Yes

**Description:**  
URL to receive webhook notifications.

**Example:**
```typescript
webhookUrl: "https://api.example.com/webhooks/erp"
```

---

### 12.2 Backup & Recovery

#### Enable Automatic Backup

**Type:** `boolean`  
**Default:** `true`

**Description:**  
Automatically backup database.

---

#### Backup Frequency

**Type:** `'daily' | 'weekly' | 'monthly'` (dropdown)  
**Default:** `"daily"`

**Description:**  
How often backups are created.

---

### 12.3 Multi-Location

#### Enable Multi-Location

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Support multiple branches/warehouses.

**When Enabled:**
- Stock per location
- Location-wise reports
- Inter-location transfers

---

#### Default Location

**Type:** `string`  
**Default:** `"Main Store"`

**Description:**  
Default location for transactions.

---

### 12.4 Multi-Currency

#### Enable Multi-Currency

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Support transactions in multiple currencies.

---

#### Auto-Update Exchange Rate

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Fetch latest currency exchange rates.

---

### 12.5 Performance

#### Cache Duration (minutes)

**Type:** `number`  
**Min:** 0  
**Max:** 1440  
**Default:** `60`

**Description:**  
How long to cache data.

---

### 12.6 Development

#### Debug Mode

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Show detailed error messages and logs.

**⚠️ Warning:** Never enable in production

---

#### Enable Data Encryption

**Type:** `boolean`  
**Default:** `false`

**Description:**  
Encrypt sensitive data in database.

---

## Data Structure

### Settings Interface

```typescript
interface Settings {
  // General (14 settings)
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessWebsite: string;
  taxId: string;
  currency: string;
  timezone: string;
  language: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  decimalPlaces: number;
  thousandSeparator: ',' | '.' | ' ';
  
  // Module Management (8 settings)
  enablePOSModule: boolean;
  enableInventoryModule: boolean;
  enableRentalModule: boolean;
  enableStudioModule: boolean;
  enableCustomizeModule: boolean;
  enableAccountingModule: boolean;
  enableExpensesModule: boolean;
  enableReportsModule: boolean;
  
  // Theme (9 settings)
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  darkMode: boolean;
  compactMode: boolean;
  sidebarPosition: 'left' | 'right';
  showBreadcrumbs: boolean;
  animationsEnabled: boolean;
  
  // Invoice (11 settings)
  invoicePrefix: string;
  invoiceNumberFormat: string;
  invoiceStartNumber: number;
  invoiceTemplate: 'modern' | 'classic' | 'minimal';
  showTaxOnInvoice: boolean;
  showDiscountOnInvoice: boolean;
  invoiceTerms: string;
  invoiceFooter: string;
  invoiceLogoPosition: 'left' | 'center' | 'right';
  invoiceDueDays: number;
  invoiceWatermark: string;
  
  // Product (13 settings)
  skuFormat: string;
  skuAutoGenerate: boolean;
  lowStockThreshold: number;
  enableBarcode: boolean;
  barcodeFormat: 'CODE128' | 'EAN13' | 'QR';
  defaultProductUnit: string;
  enableProductVariants: boolean;
  enableProductExpiry: boolean;
  enableProductImages: boolean;
  maxProductImages: number;
  productCodePrefix: string;
  trackSerialNumbers: boolean;
  enableBatchTracking: boolean;
  
  // Sales (20 settings)
  defaultTaxRate: number;
  enableMultipleTax: boolean;
  maxDiscountPercent: number;
  requireCustomerForSale: boolean;
  enableLayaway: boolean;
  allowNegativeStock: boolean;
  defaultPaymentMethod: string;
  printReceiptAutomatically: boolean;
  duplicateItemBehavior: 'increase_quantity' | 'add_new_row';
  autoSaveInterval: number;
  enableQuickSale: boolean;
  showStockInSale: boolean;
  requireSaleApproval: boolean;
  minimumSaleAmount: number;
  enableCustomerCredit: boolean;
  creditLimit: number;
  enableLoyaltyPoints: boolean;
  pointsPerCurrency: number;
  enableSaleReturns: boolean;
  returnDaysLimit: number;
  
  // Purchase (9 settings)
  purchaseOrderPrefix: string;
  requirePurchaseApproval: boolean;
  defaultPurchaseTax: number;
  enablePurchaseReturn: boolean;
  enableVendorRating: boolean;
  purchaseApprovalAmount: number;
  enableGRN: boolean;
  grnPrefix: string;
  enableQualityCheck: boolean;
  
  // Rental (9 settings)
  rentalPrefix: string;
  defaultRentalDuration: number;
  lateFeePerDay: number;
  securityDepositPercent: number;
  enableRentalReminders: boolean;
  reminderDaysBefore: number;
  enableDamageCharges: boolean;
  damageAssessmentRequired: boolean;
  autoCalculateLateFee: boolean;
  
  // Reports (9 settings)
  reportDateFormat: string;
  reportCurrency: string;
  enableAutoReports: boolean;
  reportEmailFrequency: 'daily' | 'weekly' | 'monthly';
  includeGraphsInReports: boolean;
  defaultReportPeriod: 'week' | 'month' | 'quarter' | 'year';
  enableExportPDF: boolean;
  enableExportExcel: boolean;
  enableExportCSV: boolean;
  
  // Notifications (9 settings)
  emailNotifications: boolean;
  smsNotifications: boolean;
  lowStockAlert: boolean;
  paymentDueAlert: boolean;
  rentalReturnAlert: boolean;
  expiryAlert: boolean;
  expiryAlertDays: number;
  orderStatusNotification: boolean;
  dailySalesSummary: boolean;
  
  // Security (9 settings)
  twoFactorAuth: boolean;
  sessionTimeout: number;
  passwordPolicy: 'weak' | 'medium' | 'strong';
  enableAuditLog: boolean;
  ipWhitelist: string;
  maxLoginAttempts: number;
  lockoutDuration: number;
  requireEmailVerification: boolean;
  enableRoleBasedAccess: boolean;
  
  // Advanced (12 settings)
  enableAPI: boolean;
  apiKey: string;
  webhookUrl: string;
  enableBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  debugMode: boolean;
  enableMultiLocation: boolean;
  defaultLocation: string;
  enableMultiCurrency: boolean;
  autoUpdateExchangeRate: boolean;
  enableDataEncryption: boolean;
  cacheDuration: number;
}
```

---

## Implementation Guide

### 1. Storage

**LocalStorage Key:** `erp_settings`

```typescript
// Save settings
localStorage.setItem('erp_settings', JSON.stringify(settings));

// Load settings
const savedSettings = JSON.parse(localStorage.getItem('erp_settings'));
```

---

### 2. Default Values

```typescript
const DEFAULT_SETTINGS: Settings = {
  // General
  businessName: 'Din Collection',
  businessAddress: 'Main Market, Lahore, Pakistan',
  businessPhone: '+92 300 1234567',
  businessEmail: 'info@dincollection.com',
  businessWebsite: 'www.dincollection.com',
  taxId: 'TAX-123456',
  currency: 'PKR',
  timezone: 'Asia/Karachi',
  language: 'en',
  fiscalYearStart: '01-01',
  fiscalYearEnd: '12-31',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  decimalPlaces: 2,
  thousandSeparator: ',',
  
  // Modules - All enabled by default
  enablePOSModule: true,
  enableInventoryModule: true,
  enableRentalModule: true,
  enableStudioModule: true,
  enableCustomizeModule: true,
  enableAccountingModule: true,
  enableExpensesModule: true,
  enableReportsModule: true,
  
  // ... (all other defaults)
};
```

---

### 3. Validation Rules

```typescript
const validateSettings = (settings: Settings): ValidationResult => {
  const errors: string[] = [];
  
  // Required fields
  if (!settings.businessName) {
    errors.push('Business name is required');
  }
  
  // Email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.businessEmail)) {
    errors.push('Invalid email format');
  }
  
  // Percentage ranges
  if (settings.defaultTaxRate < 0 || settings.defaultTaxRate > 100) {
    errors.push('Tax rate must be between 0 and 100');
  }
  
  // Fiscal year validation
  const startMonth = parseInt(settings.fiscalYearStart.split('-')[0]);
  if (startMonth < 1 || startMonth > 12) {
    errors.push('Invalid fiscal year start month');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
```

---

### 4. Usage in Application

#### POS System
```typescript
// Check if POS module enabled
if (settings.enablePOSModule) {
  // Show POS menu item
  // Allow POS route
}

// Duplicate item behavior
if (settings.duplicateItemBehavior === 'increase_quantity') {
  increaseQuantity(item);
} else {
  addNewRow(item);
}

// Tax calculation
const taxAmount = subtotal * (settings.defaultTaxRate / 100);
```

#### Invoice Generation
```typescript
const generateInvoice = () => {
  const invoiceNumber = `${settings.invoicePrefix}-${format}`;
  const dueDate = addDays(today, settings.invoiceDueDays);
  
  return {
    number: invoiceNumber,
    date: today,
    dueDate: dueDate,
    template: settings.invoiceTemplate,
    logoPosition: settings.invoiceLogoPosition,
    terms: settings.invoiceTerms,
    footer: settings.invoiceFooter,
    watermark: settings.invoiceWatermark,
    showTax: settings.showTaxOnInvoice,
    showDiscount: settings.showDiscountOnInvoice
  };
};
```

#### Number Formatting
```typescript
const formatAmount = (amount: number): string => {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: settings.decimalPlaces,
    maximumFractionDigits: settings.decimalPlaces,
    useGrouping: true
  }).replace(/,/g, settings.thousandSeparator);
};

// Example: 1500000.50
// With comma: "1,500,000.50"
// With period: "1.500.000,50"
```

---

### 5. Change Detection

```typescript
const [settings, setSettings] = useState<Settings>(initialSettings);
const [hasChanges, setHasChanges] = useState(false);

const handleChange = (field: keyof Settings, value: any) => {
  setSettings({ ...settings, [field]: value });
  setHasChanges(true);
};

const handleSave = () => {
  localStorage.setItem('erp_settings', JSON.stringify(settings));
  setHasChanges(false);
  showSuccessMessage('Settings saved successfully!');
};
```

---

## Best Practices

### 1. Regular Backups
- Export settings regularly
- Keep backup of working configuration
- Document custom changes

### 2. Testing
- Test settings changes in staging environment
- Verify impact on existing data
- Check integration points

### 3. Security
- Restrict settings access to admins only
- Audit log all settings changes
- Never expose API keys in UI

### 4. Performance
- Cache settings in memory
- Minimize localStorage reads
- Use default values efficiently

### 5. Documentation
- Document business-specific settings
- Train staff on critical settings
- Maintain change log

---

## Troubleshooting

### Issue: Settings not persisting
**Solution:** Check localStorage quota and browser permissions

### Issue: Module disabled but still showing
**Solution:** Clear cache and reload application

### Issue: Invalid fiscal year dates
**Solution:** Ensure end date is after start date

### Issue: Decimal places not applying
**Solution:** Check number formatting function

---

## Migration Guide

### From Version 1.0 to 2.0

1. **Backup current settings**
2. **Check new fields**
3. **Update data structure**
4. **Test thoroughly**
5. **Deploy changes**

---

## Summary

**Total Settings:** 127  
**Categories:** 12  
**File Location:** `/src/app/components/settings/SettingsPage.tsx`  
**Storage:** LocalStorage  
**Persistence:** Automatic

This comprehensive settings system provides complete control over every aspect of the Din Collection ERP system, from basic business information to advanced technical configurations.

---

**End of Documentation**

For support or questions, contact: support@dincollection.com
