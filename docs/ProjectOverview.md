# Project Structure & Architecture

## Overview
Din Collection Bridal ERP is a React-based application using Tailwind CSS. It is structured to support a comprehensive retail and rental business model.

## Global Design System
- **Background**: Strict Dark Mode (`#111827`)
- **Accent Colors**: Green (Success/Money), Blue (Primary Actions), Red (Alerts/Debt)
- **Framework**: React + Tailwind CSS v4

## Core Modules
1. **Dashboard**: Analytics and Quick Actions.
2. **POS**: Point of Sale for Retail and Rentals.
3. **Products**: Inventory management with barcodes and variants.
4. **Custom Studio**: Manufacturing pipeline and vendor management.
5. **Rentals**: Booking calendar and security deposit tracking.
6. **Purchases**: Vendor payments and PO management.
7. **Sales**: Sales history and invoicing.
8. **Accounting**: Financial ledgers and banking.
9. **Reports**: Business intelligence.
10. **Contacts**: CRM for customers and suppliers.
11. **Users**: Role-based access control.
12. **Settings**: System-wide configuration.

## Directory Structure
- `/src/app/components/*`: Functional modules.
- `/src/app/components/ui/*`: Shared UI components (Shadcn/UI based).
- `/src/styles`: Global styles and themes.

## Instructions for AI
- Always verify the file path before editing.
- Respect the strict dark mode color palette.
- Use existing UI components from `src/app/components/ui` whenever possible.
- When adding new features, create a corresponding documentation entry if the logic is complex.
