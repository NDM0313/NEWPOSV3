# Phase 2 High Priority Batch Migration - Status

## Files in Progress

### 1. SettingsPage.tsx ⚠️ IN PROGRESS
- **Total Instances**: ~397
- **Fixed**: ~50
- **Remaining**: ~347
- **Status**: Complex conditional classes, module cards, many form inputs

**Patterns Fixed**:
- ✅ Header text colors
- ✅ Button styles
- ✅ Tab navigation
- ✅ Form labels
- ✅ Input fields
- ✅ Select dropdowns
- ⚠️ Module cards (in progress)
- ⚠️ Conditional styling (in progress)

**Remaining Patterns**:
- Module card conditional classes
- Badge conditional classes
- Icon conditional colors
- Theme settings
- Invoice settings
- Product settings
- Sales settings

---

## Migration Strategy for Complex Conditionals

### Pattern: Conditional Module Cards
```tsx
// ❌ Before
className={`p-5 rounded-xl border-2 ${
  isActive
    ? 'bg-purple-500/10 border-purple-500'
    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
}`}

// ✅ After
className="p-5 rounded-xl border-2"
style={{
  backgroundColor: isActive ? 'rgba(147, 51, 234, 0.1)' : 'rgba(31, 41, 55, 0.5)',
  borderColor: isActive ? 'var(--color-wholesale)' : 'var(--color-border-secondary)',
  borderWidth: '2px',
  borderRadius: 'var(--radius-xl)'
}}
onMouseEnter={(e) => {
  if (!isActive) {
    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
  }
}}
onMouseLeave={(e) => {
  if (!isActive) {
    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
  }
}}
```

### Pattern: Conditional Icons
```tsx
// ❌ Before
<ShoppingCart className={isActive ? 'text-purple-400' : 'text-gray-500'} />

// ✅ After
<ShoppingCart 
  style={{ 
    color: isActive ? 'var(--color-wholesale)' : 'var(--color-text-tertiary)' 
  }} 
/>
```

### Pattern: Conditional Badges
```tsx
// ❌ Before
<Badge className={`${
  isActive 
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
    : 'bg-gray-700 text-gray-400 border-gray-600'
}`}>

// ✅ After
<Badge 
  style={{
    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.2)' : 'var(--color-hover-bg)',
    color: isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
    borderColor: isActive ? 'rgba(16, 185, 129, 0.3)' : 'var(--color-border-secondary)'
  }}
>
```

---

## Next Steps

1. **Complete SettingsPage.tsx** - Fix remaining ~347 instances
2. **Move to SaleForm.tsx** - 189 instances
3. **Continue with remaining high-priority files**

---

**Status**: In Progress
**Current File**: SettingsPage.tsx (~12% complete)
