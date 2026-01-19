# Dialog Accessibility Guidelines

**Din Collection ERP - Accessibility Best Practices**

## ✅ Fixed - All Dialogs Now Accessible

All `DialogContent` components in the codebase have been updated to include proper `DialogTitle` elements for screen reader accessibility.

---

## Required Pattern

Every `DialogContent` **MUST** include a `DialogTitle` wrapped in `DialogHeader`.

### ✅ Correct Pattern:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title Here</DialogTitle>
      <DialogDescription>Optional description</DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

## For Visually Hidden Titles

If you want to hide the title visually but keep it accessible for screen readers, use the `sr-only` class:

### ✅ Correct Pattern:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader className="sr-only">
      <DialogTitle>Accessible Title for Screen Readers</DialogTitle>
    </DialogHeader>
    {/* Your custom header can go here */}
    <div className="custom-header">
      {/* Visual header content */}
    </div>
  </DialogContent>
</Dialog>
```

---

## All Fixed Components

### ✅ Command.tsx
```tsx
<DialogContent className="overflow-hidden p-0">
  <DialogHeader className="sr-only">
    <DialogTitle>{title}</DialogTitle>
    <DialogDescription>{description}</DialogDescription>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ QuickAddProductModal.tsx
```tsx
<DialogContent className="sm:max-w-[700px] bg-gray-900 text-white border-gray-800">
  <DialogHeader className="sr-only">
    <DialogTitle>Quick Add Product</DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ PrintBarcodeModal.tsx
```tsx
<DialogContent className="sm:max-w-[600px] bg-gray-900 text-white border-gray-800">
  <DialogHeader className="sr-only">
    <DialogTitle>Print Labels for: {productName}</DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ ThermalReceiptPreviewModal.tsx
```tsx
<DialogContent className="max-w-md bg-transparent border-none shadow-none p-0">
  <DialogTitle className="sr-only">Receipt Preview</DialogTitle>
  {/* Content */}
</DialogContent>
```

### ✅ QuickAddContactModal.tsx
```tsx
<DialogContent className="sm:max-w-[450px] bg-gray-900 text-white border-gray-800">
  <DialogHeader className="sr-only">
    <DialogTitle>Quick Add Customer</DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ AddPaymentModal.tsx
```tsx
<DialogContent className="sm:max-w-[450px] bg-gray-900 text-white border-gray-800">
  <DialogHeader className="sr-only">
    <DialogTitle>Record Payment for {purchaseOrderId}</DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ FundsTransferModal.tsx
```tsx
<DialogContent className="sm:max-w-[600px] bg-gray-900 text-white border-gray-800">
  <DialogHeader className="sr-only">
    <DialogTitle>Transfer Funds</DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ PackingEntryModal.tsx
```tsx
<DialogContent className="sm:max-w-[700px] bg-gray-900 border-gray-800 text-white">
  <DialogHeader>
    <DialogTitle>Packing Entry</DialogTitle>
    <DialogDescription>Enter box, piece, and meter details</DialogDescription>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ AddCategoryModal.tsx
```tsx
<DialogContent className="sm:max-w-[425px] bg-[#1F2937] border-gray-700 text-white">
  <DialogHeader>
    <DialogTitle>Add New Category</DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### ✅ QuickAddDropdown.tsx
```tsx
<DialogContent className="sm:max-w-[400px] bg-gray-900 border-gray-800 text-white">
  <DialogHeader>
    <DialogTitle>Add New Item</DialogTitle>
    <DialogDescription>Enter the name and save to add it to the list.</DialogDescription>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

---

## Verification Checklist

Before committing any Dialog component:

- [ ] Does the `DialogContent` have a `DialogHeader`?
- [ ] Does the `DialogHeader` contain a `DialogTitle`?
- [ ] Is the title descriptive enough for screen reader users?
- [ ] If visually hidden, is `sr-only` class applied to `DialogHeader`?
- [ ] Is `DialogDescription` included if additional context is needed?

---

## Why This Matters

1. **Screen Reader Users** - The DialogTitle provides essential context to users navigating with assistive technologies
2. **Accessibility Standards** - Follows WCAG 2.1 guidelines for accessible dialogs
3. **Radix UI Requirements** - The underlying Radix Dialog primitive requires a title for proper ARIA labeling

---

## Common Mistakes to Avoid

### ❌ WRONG - No DialogTitle
```tsx
<DialogContent>
  <div>My Custom Header</div>
  {/* Content */}
</DialogContent>
```

### ❌ WRONG - DialogTitle outside DialogHeader
```tsx
<DialogContent>
  <DialogTitle>Title</DialogTitle>
  {/* Content */}
</DialogContent>
```

### ❌ WRONG - Empty DialogTitle
```tsx
<DialogContent>
  <DialogHeader>
    <DialogTitle></DialogTitle>
  </DialogHeader>
</DialogContent>
```

---

## Resources

- [Radix UI Dialog Documentation](https://radix-ui.com/primitives/docs/components/dialog)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

---

**Last Updated:** January 6, 2026  
**Status:** ✅ All components verified and fixed
