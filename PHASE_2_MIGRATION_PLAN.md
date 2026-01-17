# Phase 2 Migration Plan - Tailwind Color Classes

## Scope Analysis

**Target**: Eliminate ALL Tailwind color utility classes
**Estimated Instances**: 1850+ across 130+ files

## Color Mapping Strategy

### Background Colors
- `bg-gray-900` → `var(--color-bg-primary)`
- `bg-gray-950` → `var(--color-bg-tertiary)`
- `bg-gray-800` → `var(--color-bg-card)`
- `bg-gray-700` → `var(--color-hover-bg)`
- `bg-gray-600` → `var(--color-bg-card)` (darker variant)
- `bg-white` → `var(--color-text-primary)` (for contrast)
- `bg-black` → `var(--color-bg-primary)` (darkest)

### Text Colors
- `text-white` → `var(--color-text-primary)`
- `text-black` → `var(--color-text-primary)` (inverted context)
- `text-gray-400` → `var(--color-text-secondary)`
- `text-gray-500` → `var(--color-text-tertiary)`
- `text-gray-600` → `var(--color-text-disabled)`
- `text-gray-300` → `var(--color-text-primary)` (lighter)
- `text-gray-200` → `var(--color-text-primary)` (lightest)

### Border Colors
- `border-gray-800` → `var(--color-border-primary)`
- `border-gray-700` → `var(--color-border-secondary)`
- `border-gray-600` → `var(--color-border-secondary)` (lighter)
- `border-white` → `var(--color-border-primary)` (contrast)
- `border-black` → `var(--color-border-primary)` (darkest)

### Semantic Colors
- `bg-blue-600` → `var(--color-primary)`
- `bg-blue-500` → `var(--color-primary-hover)`
- `bg-green-500` → `var(--color-success)`
- `bg-red-500` → `var(--color-error)`
- `bg-orange-500` → `var(--color-warning)`
- `bg-purple-600` → `var(--color-wholesale)`

### Hover States
- `hover:bg-gray-800` → `onMouseEnter` with `var(--color-hover-bg)`
- `hover:bg-gray-700` → `onMouseEnter` with `var(--color-hover-bg)`
- `hover:text-white` → `onMouseEnter` with `var(--color-text-primary)`
- `hover:border-gray-600` → `onMouseEnter` with `var(--color-border-secondary)`

## Migration Batches

### Batch 1: Core UI Components (10 files)
- ui/button.tsx
- ui/input.tsx
- ui/card.tsx
- ui/dialog.tsx
- ui/drawer.tsx
- ui/sheet.tsx
- ui/popover.tsx
- ui/tooltip.tsx
- ui/badge.tsx
- ui/alert.tsx

### Batch 2: Layout Components (5 files)
- layout/Sidebar.tsx (remaining)
- layout/TopHeader.tsx (remaining)
- layout/Layout.tsx
- layout/BottomNav.tsx
- layout/BranchSelector.tsx

### Batch 3: Feature Pages (30 files)
- expenses/ExpensesList.tsx
- sales/SaleForm.tsx
- purchases/PurchaseForm.tsx
- products/ProductList.tsx
- dashboard/Dashboard.tsx
- ... (25 more)

### Batch 4: Forms & Drawers (25 files)
- All form components
- All drawer components
- All modal components

### Batch 5: Tables & Lists (20 files)
- All table components
- All list components
- All card components

### Batch 6: Remaining Components (40 files)
- All other feature components
- Demo components
- Utility components

## Migration Pattern

### Simple Replacement
```tsx
// ❌ Before
<div className="bg-gray-900 text-white border-gray-800">

// ✅ After
<div 
  style={{
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-primary)'
  }}
>
```

### With Hover
```tsx
// ❌ Before
<button className="bg-gray-800 hover:bg-gray-700 text-white">

// ✅ After
<button
  style={{
    backgroundColor: 'var(--color-bg-card)',
    color: 'var(--color-text-primary)'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
  }}
>
```

### Conditional Classes
```tsx
// ❌ Before
<div className={cn("bg-gray-900", isActive && "bg-blue-600")}>

// ✅ After
<div 
  style={{
    backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg-primary)'
  }}
>
```

## Progress Tracking

- [ ] Batch 1: Core UI (0/10)
- [ ] Batch 2: Layout (0/5)
- [ ] Batch 3: Feature Pages (0/30)
- [ ] Batch 4: Forms & Drawers (0/25)
- [ ] Batch 5: Tables & Lists (0/20)
- [ ] Batch 6: Remaining (0/40)

**Total**: 0/130 files
