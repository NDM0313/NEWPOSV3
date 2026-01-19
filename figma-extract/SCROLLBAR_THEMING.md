# Global Scrollbar Theming

## Overview
All scrollbars across the ERP system are themed to match the dark mode design, providing a cohesive visual experience.

## Implementation

### Location
`/src/styles/theme.css` - in `@layer base` section

### CSS Code
```css
/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #4b5563 #1f2937;
}

/* Webkit browsers (Chrome, Safari, Edge) */
*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

*::-webkit-scrollbar-track {
  background: #1f2937;
  border-radius: 4px;
}

*::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 4px;
  border: 2px solid #1f2937;
}

*::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

*::-webkit-scrollbar-corner {
  background: #1f2937;
}
```

## Color Mapping

| Element | Color | Tailwind Equivalent |
|---------|-------|---------------------|
| Track | `#1f2937` | `gray-800` |
| Thumb | `#4b5563` | `gray-600` |
| Thumb (Hover) | `#6b7280` | `gray-500` |
| Corner | `#1f2937` | `gray-800` |

## Coverage

The scrollbar styling applies globally to:
- ✅ All pages
- ✅ All modules
- ✅ All forms
- ✅ All modals
- ✅ All dashboards
- ✅ All tables
- ✅ All dropdowns with overflow
- ✅ Sidebar navigation
- ✅ Command palettes
- ✅ Settings panels

## Browser Support

### Full Support
- ✅ Chrome/Edge (Webkit)
- ✅ Safari (Webkit)
- ✅ Firefox (Gecko)

### Graceful Degradation
- Older browsers: Falls back to default scrollbar
- Mobile browsers: Uses native scrollbar

## Visual Example

```
┌─────────────────────────────┐
│ Content Area                │
│                             │
│                             │ ◄── Track: #1f2937 (gray-800)
│                        ┌────┤
│                        │████│ ◄── Thumb: #4b5563 (gray-600)
│                        │████│
│                        └────┤
│                             │
│                             │
└─────────────────────────────┘
```

### Hover State
```
Thumb changes to: #6b7280 (gray-500)
```

## Design Rationale

1. **Consistency**: Matches the dark mode gray scale
2. **Visibility**: Thumb (#4b5563) is visible against track (#1f2937)
3. **Subtlety**: Not too bright, maintains focus on content
4. **Hover Feedback**: Lighter on hover (#6b7280) for better UX
5. **Rounded**: 4px border-radius for modern appearance

## Testing

Test scrollbar appearance in:
- [ ] Dashboard with charts
- [ ] Sales/Purchase forms (long item lists)
- [ ] Settings page (many options)
- [ ] Contact list (table view)
- [ ] Product inventory (large datasets)
- [ ] Studio production (workflow steps)
- [ ] Command palette (dropdown lists)
- [ ] Modals with overflow content

## Customization

To modify scrollbar theme:

1. Edit `/src/styles/theme.css`
2. Update colors in `@layer base` section
3. Maintain color consistency with theme tokens
4. Test across all major browsers

### Example: Lighter Track
```css
*::-webkit-scrollbar-track {
  background: #374151;  /* gray-700 instead of gray-800 */
}
```

### Example: Accent Thumb
```css
*::-webkit-scrollbar-thumb {
  background: #3b82f6;  /* blue-500 */
}

*::-webkit-scrollbar-thumb:hover {
  background: #2563eb;  /* blue-600 */
}
```

## Performance

- ✅ No JavaScript required
- ✅ Pure CSS implementation
- ✅ No performance impact
- ✅ Applied via global stylesheet

## Maintenance

When updating the theme:
1. Ensure scrollbar colors match the active theme
2. Test in both light and dark environments
3. Verify contrast ratios for accessibility
4. Check consistency across all modules

---

**Status:** ✅ Implemented Globally

**Last Updated:** January 2026

**Applies To:** All scrollable elements system-wide
