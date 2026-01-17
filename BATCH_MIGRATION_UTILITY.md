# Batch Migration Utility - Automated Replacements

## Common Pattern Replacements

### Text Colors (Batch Replace)
```tsx
// Pattern 1: text-gray-400
className="text-gray-400" → style={{ color: 'var(--color-text-secondary)' }}

// Pattern 2: text-gray-500
className="text-gray-500" → style={{ color: 'var(--color-text-tertiary)' }}

// Pattern 3: text-white
className="text-white" → style={{ color: 'var(--color-text-primary)' }}

// Pattern 4: text-gray-300
className="text-gray-300" → style={{ color: 'var(--color-text-primary)' }}
```

### Background Colors (Batch Replace)
```tsx
// Pattern 1: bg-gray-900
className="bg-gray-900" → style={{ backgroundColor: 'var(--color-bg-primary)' }}

// Pattern 2: bg-gray-950
className="bg-gray-950" → style={{ backgroundColor: 'var(--color-bg-tertiary)' }}

// Pattern 3: bg-gray-800
className="bg-gray-800" → style={{ backgroundColor: 'var(--color-bg-card)' }}

// Pattern 4: bg-gray-700
className="bg-gray-700" → style={{ backgroundColor: 'var(--color-hover-bg)' }}
```

### Border Colors (Batch Replace)
```tsx
// Pattern 1: border-gray-800
className="border-gray-800" → style={{ borderColor: 'var(--color-border-primary)' }}

// Pattern 2: border-gray-700
className="border-gray-700" → style={{ borderColor: 'var(--color-border-secondary)' }}
```

### Hover States (Requires Manual)
```tsx
// Pattern: hover:bg-gray-800 hover:text-white
// Requires onMouseEnter/onMouseLeave handlers
```

### Semantic Colors (Batch Replace)
```tsx
// Pattern 1: bg-blue-600
className="bg-blue-600" → style={{ backgroundColor: 'var(--color-primary)' }}

// Pattern 2: text-blue-500
className="text-blue-500" → style={{ color: 'var(--color-primary)' }}

// Pattern 3: bg-green-500
className="bg-green-500" → style={{ backgroundColor: 'var(--color-success)' }}

// Pattern 4: bg-red-500
className="bg-red-500" → style={{ backgroundColor: 'var(--color-error)' }}
```

## Automated Replacement Script Pattern

For each file:
1. Replace simple text colors
2. Replace simple background colors
3. Replace simple border colors
4. Replace semantic colors
5. Handle hover states manually (complex)
