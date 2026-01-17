# Phase 2 Progress - Tailwind Color Classes Migration

## Status: IN PROGRESS

**Started**: After Phase 1 completion
**Total Scope**: 4049+ instances across 95 files
**Completed**: ~50 instances (1.2%)
**Remaining**: ~4000 instances (98.8%)

---

## Migration Pattern Established

### Pattern 1: Simple Text Colors
```tsx
// ❌ Before
className="text-gray-400"
className="text-white"

// ✅ After
style={{ color: 'var(--color-text-secondary)' }}
style={{ color: 'var(--color-text-primary)' }}
```

### Pattern 2: Background Colors
```tsx
// ❌ Before
className="bg-gray-900"
className="bg-gray-800"

// ✅ After
style={{ backgroundColor: 'var(--color-bg-primary)' }}
style={{ backgroundColor: 'var(--color-bg-card)' }}
```

### Pattern 3: Border Colors
```tsx
// ❌ Before
className="border-gray-800"

// ✅ After
style={{ borderColor: 'var(--color-border-primary)' }}
```

### Pattern 4: Hover States
```tsx
// ❌ Before
className="hover:bg-gray-800 hover:text-white"

// ✅ After
style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
onMouseEnter={(e) => {
  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
  e.currentTarget.style.color = 'var(--color-text-primary)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
  e.currentTarget.style.color = 'var(--color-text-secondary)';
}}
```

### Pattern 5: Semantic Colors
```tsx
// ❌ Before
className="bg-blue-600"
className="text-blue-500"
className="bg-green-500"

// ✅ After
style={{ backgroundColor: 'var(--color-primary)' }}
style={{ color: 'var(--color-primary)' }}
style={{ backgroundColor: 'var(--color-success)' }}
```

---

## Files Migrated (Partial)

### ✅ TransactionForm.tsx
- **Status**: ~50% complete
- **Instances Fixed**: ~25/44
- **Remaining**: ~19 instances

**Fixed Patterns**:
- ✅ Button text colors
- ✅ Background colors
- ✅ Hover states
- ✅ Semantic colors (blue, green)
- ✅ Border colors
- ✅ Icon colors

**Remaining**:
- Cart section colors
- Footer colors
- Additional hover states

---

## Files Pending Migration

### High Priority (Most Instances)
1. **TransactionForm.tsx** - 44 instances (in progress)
2. **ExpensesList.tsx** - 55 instances
3. **SaleForm.tsx** - 189 instances
4. **SettingsPage.tsx** - 397 instances
5. **StudioWorkflowPage.tsx** - 131 instances
6. **PackingEntryPage.tsx** - 149 instances
7. **PurchaseForm.tsx** - 78 instances

### Medium Priority
- Dashboard components
- Product components
- Accounting components
- Contact components

### Lower Priority
- Demo components
- Utility components
- Example components

---

## Color Mapping Reference

### Gray Scale
- `gray-900` → `var(--color-bg-primary)`
- `gray-950` → `var(--color-bg-tertiary)`
- `gray-800` → `var(--color-bg-card)` / `var(--color-border-primary)`
- `gray-700` → `var(--color-hover-bg)` / `var(--color-border-secondary)`
- `gray-600` → `var(--color-text-disabled)`
- `gray-500` → `var(--color-text-tertiary)`
- `gray-400` → `var(--color-text-secondary)`
- `gray-300` → `var(--color-text-primary)` (lighter)
- `gray-200` → `var(--color-text-primary)` (lightest)

### Semantic Colors
- `blue-600` → `var(--color-primary)`
- `blue-500` → `var(--color-primary-hover)`
- `blue-400` → `var(--color-primary)` (lighter)
- `green-500` → `var(--color-success)`
- `red-500` → `var(--color-error)`
- `orange-500` → `var(--color-warning)`
- `purple-600` → `var(--color-wholesale)`

### Special Cases
- `white` → `var(--color-text-primary)`
- `black` → `var(--color-bg-primary)` (inverted context)
- Opacity variants: `bg-gray-800/50` → `rgba(31, 41, 55, 0.5)`

---

## Next Steps

1. **Complete TransactionForm.tsx** - Finish remaining 19 instances
2. **Migrate ExpensesList.tsx** - 55 instances
3. **Migrate SaleForm.tsx** - 189 instances (large file)
4. **Continue with high-priority files**
5. **Batch process medium-priority files**
6. **Final sweep of remaining files**

---

## Estimated Completion

- **Current Rate**: ~25 instances per file
- **Files Remaining**: ~95 files
- **Estimated Total Time**: Significant (4000+ instances)

**Recommendation**: Continue systematic migration, focusing on high-impact files first.

---

**Last Updated**: During Phase 2 migration
**Status**: In Progress (1.2% complete)
