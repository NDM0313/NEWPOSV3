# Products Management Module Documentation

## Overview
This module handles the inventory of bridal wear, including adding, editing, and listing products. It supports barcode printing and stock history.

## Components
- `src/app/components/products/EnhancedProductForm.tsx`: Advanced form for creating/editing products.
- `src/app/components/products/ProductList.tsx`: Grid/List view of all products.
- `src/app/components/products/ProductDrawer.tsx`: Slide-out details view.
- `src/app/components/products/PrintBarcodeModal.tsx`: Barcode generation.
- `src/app/components/products/QuickAddProductModal.tsx`: Simplified addition modal.

## Recent Changes
- Manual edits have been made to `EnhancedProductForm.tsx`.
- Integration of "3 dots" menus and interactive elements.
- Implemented `react-dropzone` for image uploads.
- Validated using `zod` and `react-hook-form`.

## Tech Stack
- React
- Tailwind CSS
- React Hook Form
- Zod
- React Dropzone

## Cursor AI Instructions
When working on this module:
1. Respect the recent manual edits in `EnhancedProductForm.tsx`.
2. Ensure all forms validate correctly before submission.
3. Maintain the strict dark mode styling.
4. Handle image uploads and gallery views efficiently.
