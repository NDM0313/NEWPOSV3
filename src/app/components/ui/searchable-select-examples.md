# SearchableSelect Component - Global Pattern

## Overview
The `SearchableSelect` component provides a standardized way to create searchable dropdowns with "Add New" functionality throughout the ERP system.

## Key Features
- ✅ Searchable dropdown with keyboard support
- ✅ "Add New" button when no results found
- ✅ Custom filtering and rendering
- ✅ Consistent dark theme styling
- ✅ Prevents workflow dead-ends

## Usage Examples

### 1. Customer Selection (Sales Form)
```tsx
import { SearchableSelect } from "@/app/components/ui/searchable-select";
import { User } from 'lucide-react';

<SearchableSelect
    value={customerId}
    onValueChange={setCustomerId}
    options={customers.map(c => ({ id: c.id.toString(), name: c.name }))}
    placeholder="Select Customer"
    searchPlaceholder="Search customer..."
    icon={<User size={14} className="text-gray-400 shrink-0" />}
    enableAddNew={true}
    addNewLabel="Add New Customer"
    onAddNew={() => {
        // Open Contact form with type="customer"
        openContactForm('customer');
    }}
/>
```

### 2. Supplier Selection (Purchase Form)
```tsx
<SearchableSelect
    value={supplierId}
    onValueChange={setSupplierId}
    options={suppliers.map(s => ({ id: s.id.toString(), name: s.name }))}
    placeholder="Select Supplier"
    searchPlaceholder="Search supplier..."
    icon={<User size={14} className="text-gray-400 shrink-0" />}
    enableAddNew={true}
    addNewLabel="Add New Supplier"
    onAddNew={() => {
        openContactForm('supplier');
    }}
/>
```

### 3. Account Selection (Accounting Forms)
```tsx
<SearchableSelect
    value={accountId}
    onValueChange={setAccountId}
    options={accounts.map(a => ({ id: a.id, name: a.name, code: a.code }))}
    placeholder="Select Account"
    searchPlaceholder="Search account..."
    enableAddNew={true}
    addNewLabel="Create New Account"
    onAddNew={() => {
        // Redirect to account creation
        setCurrentView('accounting-add-account');
    }}
    renderOption={(account) => (
        <div className="flex justify-between w-full">
            <span>{account.name}</span>
            <span className="text-xs text-gray-500">{account.code}</span>
        </div>
    )}
/>
```

### 4. Worker Selection (Studio/Production)
```tsx
<SearchableSelect
    value={workerId}
    onValueChange={setWorkerId}
    options={workers.map(w => ({ id: w.id, name: w.name, role: w.role }))}
    placeholder="Select Worker"
    searchPlaceholder="Search worker..."
    enableAddNew={true}
    addNewLabel="Add New Worker"
    onAddNew={() => {
        openWorkerForm();
    }}
/>
```

### 5. Product Search with "Add New"
For product search, we use inline implementation in Command component:

```tsx
<Command className="bg-gray-950 text-white">
    <CommandInput placeholder="Search product..." />
    <CommandList>
        {filteredProducts.length === 0 ? (
            <div className="p-2">
                <div className="text-gray-500 text-sm text-center py-2">
                    No product found.
                </div>
                {searchTerm && (
                    <button
                        onClick={() => {
                            setSearchOpen(false);
                            openProductForm();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20 mt-2"
                    >
                        <Plus size={16} className="shrink-0" />
                        <span>Add New Product</span>
                    </button>
                )}
            </div>
        ) : (
            <CommandGroup>
                {filteredProducts.map((product) => (
                    <CommandItem key={product.id} value={product.name}>
                        {product.name}
                    </CommandItem>
                ))}
            </CommandGroup>
        )}
    </CommandList>
</Command>
```

## Global Implementation Checklist

### ✅ Already Implemented
- [x] Sales Form - Customer selection
- [x] Sales Form - Product search (inline)
- [x] Purchase Form - Supplier selection
- [x] Purchase Form - Product search (inline)

### 🔄 To Be Implemented
- [ ] User Management - Role selection
- [ ] Inventory - Location/Warehouse selection
- [ ] Accounting - Account selection in all forms
- [ ] Expense Form - Category selection
- [ ] Rental Form - Customer selection
- [ ] Studio - Worker/Vendor selection
- [ ] Custom Studio - Vendor selection
- [ ] Reports - Filter dropdowns

## Props Reference

```typescript
interface SearchableSelectProps {
  value: string;                    // Selected value ID
  onValueChange: (value: string) => void;  // Selection handler
  options: SearchableSelectOption[]; // Array of options
  placeholder?: string;              // Trigger button placeholder
  searchPlaceholder?: string;        // Search input placeholder
  emptyText?: string;                // Text when no results (default: "No results found.")
  className?: string;                // Custom classes for trigger
  icon?: React.ReactNode;            // Icon to show in trigger
  enableAddNew?: boolean;            // Enable "Add New" button
  addNewLabel?: string;              // "Add New" button text
  onAddNew?: () => void;             // Handler for "Add New" click
  renderOption?: (option) => ReactNode;  // Custom option rendering
  filterFn?: (option, search) => boolean; // Custom filter function
}
```

## Best Practices

1. **Always provide contextual labels**
   - ❌ "Add New"
   - ✅ "Add New Customer"
   - ✅ "Create New Account"

2. **Handle the Add New action properly**
   ```tsx
   onAddNew={() => {
       // Close current dropdown
       setDropdownOpen(false);
       
       // Open the appropriate form
       openForm('customer');
       
       // Optionally pre-fill data
       setFormData({ name: searchTerm });
   }}
   ```

3. **Use appropriate icons**
   - Customer/Supplier: `<User />`
   - Product: `<Package />`
   - Account: `<Wallet />`
   - Worker: `<UserCheck />`

4. **Maintain consistent styling**
   - All "Add New" buttons use `text-blue-400 bg-blue-500/10 hover:bg-blue-500/20`
   - Border: `border-blue-500/20`
   - Icon size: `16px`

## Integration with Forms

When adding a new entity from the "Add New" button:

1. Open the appropriate form/modal
2. Pre-fill search term if applicable
3. After successful creation:
   - Add to options list
   - Auto-select the new item
   - Close the form
   - Show success toast

```tsx
const handleAddNewCustomer = () => {
    setIsContactModalOpen(true);
    setContactType('customer');
    setPrefilledName(customerSearchTerm);
};

const handleCustomerCreated = (newCustomer) => {
    // Add to list
    setCustomers(prev => [...prev, newCustomer]);
    
    // Auto-select
    setCustomerId(newCustomer.id);
    
    // Close modal
    setIsContactModalOpen(false);
    
    // Success message
    toast.success(`Customer "${newCustomer.name}" added successfully!`);
};
```

## Accessibility

- Keyboard navigation supported (Arrow keys, Enter, Escape)
- ARIA labels automatically applied
- Focus management handled
- Screen reader friendly

## Theming

All components follow the global dark theme:
- Background: `bg-gray-950`
- Border: `border-gray-800`
- Text: `text-white`
- Hover: `hover:bg-gray-800`
- "Add New" button: Blue accent (`blue-400/500`)

---

**Note:** This pattern is mandatory for all searchable dropdowns across the system to ensure consistent user experience and prevent workflow interruptions.
