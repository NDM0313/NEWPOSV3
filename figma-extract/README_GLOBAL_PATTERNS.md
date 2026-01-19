# 🌐 Global Patterns - Quick Start Guide

Welcome to the Din Collection ERP Global Patterns documentation. This guide helps you understand and implement two critical system-wide patterns.

---

## 📋 Table of Contents

1. [Scrollbar Theming](#scrollbar-theming)
2. [Add New Pattern](#add-new-pattern)
3. [Quick Examples](#quick-examples)
4. [Full Documentation](#full-documentation)

---

## 🎨 Scrollbar Theming

### What is it?
All scrollbars in the system now match the dark theme design instead of default browser styling.

### Where is it applied?
✅ **Everywhere!** All pages, forms, modals, tables, and dashboards.

### Colors
```
Track:       #1f2937 (gray-800)
Thumb:       #4b5563 (gray-600)
Thumb Hover: #6b7280 (gray-500)
```

### How does it work?
Global CSS in `/src/styles/theme.css` automatically styles all scrollbars. **No action needed** - it just works!

### Visual Preview
```
┌──────────────┐
│ Content      │
│              │ ◄── Dark track
│         ┌────┤
│         │████│ ◄── Gray thumb
│         └────┤
└──────────────┘
```

---

## 🔍 "Add New" Pattern

### What is it?
When you search for something that doesn't exist, a button appears to create it right there.

### Why is it important?
- ❌ **Before**: Search → No results → Leave form → Create entity → Come back
- ✅ **After**: Search → No results → Click "Add New" → Create inline → Continue

### Where is it implemented?

#### ✅ Currently Active
- Sales Form → Customer selection
- Sales Form → Product search
- Purchase Form → Supplier selection
- Purchase Form → Product search

#### 🔄 Coming Soon
- Inventory → Locations, Categories
- Accounting → Account selection
- Expenses → Categories, Payees
- Studio → Workers, Vendors
- And more...

---

## 🚀 Quick Examples

### Example 1: Using SearchableSelect (Customer/Supplier)

```tsx
import { SearchableSelect } from "@/app/components/ui/searchable-select";
import { User } from 'lucide-react';

function SalesForm() {
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([...]);

  return (
    <SearchableSelect
      value={customerId}
      onValueChange={setCustomerId}
      options={customers.map(c => ({ 
        id: c.id.toString(), 
        name: c.name 
      }))}
      placeholder="Select Customer"
      searchPlaceholder="Search customer..."
      icon={<User size={14} className="text-gray-400" />}
      enableAddNew={true}
      addNewLabel="Add New Customer"
      onAddNew={() => {
        // Open your customer form/modal
        setShowCustomerForm(true);
      }}
    />
  );
}
```

### Example 2: Inline Product Search

```tsx
import { Plus } from 'lucide-react';

<Command>
  <CommandInput placeholder="Search product..." />
  <CommandList>
    {filteredProducts.length === 0 ? (
      <div className="p-2">
        <div className="text-gray-500 text-sm text-center py-2">
          No product found.
        </div>
        {searchTerm && (
          <button
            onClick={() => openProductForm()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20 mt-2"
          >
            <Plus size={16} />
            <span>Add New Product</span>
          </button>
        )}
      </div>
    ) : (
      <CommandGroup>
        {filteredProducts.map(p => (
          <CommandItem key={p.id}>{p.name}</CommandItem>
        ))}
      </CommandGroup>
    )}
  </CommandList>
</Command>
```

---

## 📚 Full Documentation

### Detailed Guides
- 📖 [`/GLOBAL_PATTERNS_IMPLEMENTATION.md`](./GLOBAL_PATTERNS_IMPLEMENTATION.md) - Complete implementation guide
- 📖 [`/SCROLLBAR_THEMING.md`](./SCROLLBAR_THEMING.md) - Scrollbar details
- 📖 [`/src/app/components/ui/searchable-select-examples.md`](./src/app/components/ui/searchable-select-examples.md) - Component usage
- 📖 [`/IMPLEMENTATION_SUMMARY.md`](./IMPLEMENTATION_SUMMARY.md) - What's been done

### Quick Reference

| Need | File | What You'll Find |
|------|------|------------------|
| **Use SearchableSelect** | `searchable-select-examples.md` | Copy-paste examples |
| **Understand scrollbars** | `SCROLLBAR_THEMING.md` | Colors, browser support |
| **Full pattern guide** | `GLOBAL_PATTERNS_IMPLEMENTATION.md` | Everything |
| **What's completed** | `IMPLEMENTATION_SUMMARY.md` | Status & checklist |

---

## 🎯 When to Use What

### Use `SearchableSelect` Component When:
✅ Selecting from a list of entities (Customer, Supplier, Account, etc.)  
✅ Need "Add New" functionality  
✅ Simple entity with name/id  

### Use Inline Command Pattern When:
✅ Product search with custom rendering  
✅ Need to show additional info (price, stock, SKU)  
✅ Complex filtering logic  

---

## 🔧 Common Scenarios

### Scenario 1: Adding New Customer in Sales Form

**User Flow:**
1. User types "John Doe" in customer search
2. No results found
3. "Add New Customer" button appears
4. User clicks button
5. Customer form opens with "John Doe" pre-filled
6. User completes and saves
7. "John Doe" is now in the list and auto-selected
8. User continues with sale

**Code:**
```tsx
onAddNew={() => {
  setCustomerFormOpen(true);
  setPrefilledName(searchTerm);
}}

// After customer is created:
const handleCustomerCreated = (newCustomer) => {
  setCustomers(prev => [...prev, newCustomer]);
  setCustomerId(newCustomer.id);
  setCustomerFormOpen(false);
  toast.success('Customer added!');
};
```

### Scenario 2: Adding New Product

**User Flow:**
1. User searches for "Blue Fabric"
2. Product not found
3. "Add New Product" button appears
4. User clicks → Product form opens
5. User creates product with details
6. Product is saved and added to current transaction
7. User continues entry

---

## 🎨 Design Standards (Must Follow)

### "Add New" Button
```tsx
// Always use this exact styling
className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20"
```

### Icons
```tsx
Customer/Supplier: <User size={14} />
Product:          <Package size={14} />
Account:          <Wallet size={14} />
Worker:           <UserCheck size={14} />
Category:         <Layers size={14} />
```

### Labels
```tsx
❌ "Add New"              // Too generic
✅ "Add New Customer"     // Specific and clear
✅ "Create New Account"   // Action-oriented
✅ "Add New Supplier"     // Contextual
```

---

## ✅ Checklist for New Implementations

When adding a new dropdown/select:

- [ ] Does it select from a list of entities?
- [ ] Could that entity be missing?
- [ ] Would creating it inline help workflow?

If **YES** to all three:

- [ ] Use `SearchableSelect` component OR inline Command pattern
- [ ] Enable `enableAddNew={true}`
- [ ] Set appropriate `addNewLabel`
- [ ] Implement `onAddNew` handler to open form/modal
- [ ] Handle entity creation and auto-selection
- [ ] Test the complete flow
- [ ] Follow design standards

---

## 🐛 Troubleshooting

### Scrollbar not themed?
1. Check if `/src/styles/theme.css` has scrollbar CSS in `@layer base`
2. Clear browser cache
3. Check browser compatibility (should work in Chrome, Firefox, Safari)

### "Add New" button not showing?
1. Verify `enableAddNew={true}` is set
2. Check if `searchTerm` is not empty (for inline implementations)
3. Verify `filteredOptions.length === 0` condition

### Button styling looks different?
1. Use the exact className from design standards
2. Don't add custom colors - use blue-400/500 scheme
3. Check if Tailwind classes are properly applied

---

## 💬 Need Help?

1. **Check Examples**: Look at Sales or Purchase forms for working implementations
2. **Read Full Guide**: `/GLOBAL_PATTERNS_IMPLEMENTATION.md` has everything
3. **Copy Component**: Use `SearchableSelect` from `/src/app/components/ui/searchable-select.tsx`
4. **Follow Pattern**: Match existing implementations in Sales/Purchase forms

---

## 🎉 Quick Wins

### For Users
✨ Smoother scrolling experience  
✨ Never stuck when entity doesn't exist  
✨ Faster data entry  
✨ Less clicking around  

### For Developers
✨ Reusable component ready  
✨ Clear patterns to follow  
✨ Comprehensive documentation  
✨ Working examples to copy  

---

## 📝 Summary

```
┌─────────────────────────────────────────┐
│                                         │
│  ✅ Scrollbars: Globally themed         │
│  ✅ Add New: Active in Sales/Purchase   │
│  🔄 Expansion: Coming to other modules  │
│                                         │
│  📚 Docs: Complete & ready              │
│  🎯 Pattern: Clear & reusable           │
│  ✨ UX: Significantly improved          │
│                                         │
└─────────────────────────────────────────┘
```

---

**Happy Coding! 🚀**

*Last Updated: January 16, 2026*
