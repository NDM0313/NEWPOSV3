# Systematic Migration Guide - Complete Reference

## Overview

This guide provides a complete reference for migrating all components from hardcoded colors to design tokens.

## Migration Patterns

### 1. Hardcoded HEX Backgrounds

**Replace:**
```tsx
// ❌ Before
<div className="bg-[#111827]">
<div className="bg-[#0B1019]">
<div className="bg-[#1F2937]">

// ✅ After
<div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
<div style={{ backgroundColor: 'var(--color-bg-panel)' }}>
<div style={{ backgroundColor: 'var(--color-bg-card)' }}>
```

### 2. Tailwind Background Colors

**Replace:**
```tsx
// ❌ Before
<div className="bg-gray-900">
<div className="bg-gray-950">
<div className="bg-gray-800">

// ✅ After
<div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
<div style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
<div style={{ backgroundColor: 'var(--color-bg-card)' }}>
```

### 3. Tailwind Text Colors

**Replace:**
```tsx
// ❌ Before
<h1 className="text-white">
<p className="text-gray-400">
<span className="text-gray-500">

// ✅ After
<h1 style={{ color: 'var(--color-text-primary)' }}>
<p style={{ color: 'var(--color-text-secondary)' }}>
<span style={{ color: 'var(--color-text-tertiary)' }}>
```

### 4. Tailwind Border Colors

**Replace:**
```tsx
// ❌ Before
<div className="border-gray-800">
<div className="border-gray-700">

// ✅ After
<div style={{ borderColor: 'var(--color-border-primary)' }}>
<div style={{ borderColor: 'var(--color-border-secondary)' }}>
```

### 5. Hover States

**Replace:**
```tsx
// ❌ Before
<button className="hover:bg-gray-800 hover:text-white">

// ✅ After
<button
  style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
    e.currentTarget.style.color = 'var(--color-text-primary)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
    e.currentTarget.style.color = 'var(--color-text-secondary)';
  }}
>
```

### 6. Date Formatting

**Replace:**
```tsx
// ❌ Before
{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
{format(date, "PPP")}
{format(date, "MMM dd")}

// ✅ After
import { formatDate, formatDateRange } from '../../../utils/dateFormat';
{formatDate(date)}  // "15 Jan 2024"
{formatDateRange(from, to)}  // "01 Jan 2024 – 31 Jan 2024"
```

## Color Mapping Reference

### Background Colors
- `bg-[#111827]` / `bg-gray-900` → `var(--color-bg-primary)`
- `bg-[#0B1019]` / `bg-gray-950` → `var(--color-bg-panel)`
- `bg-[#1F2937]` / `bg-gray-800` → `var(--color-bg-card)`
- `bg-gray-700` → `var(--color-hover-bg)`

### Text Colors
- `text-white` → `var(--color-text-primary)`
- `text-gray-400` → `var(--color-text-secondary)`
- `text-gray-500` → `var(--color-text-tertiary)`
- `text-gray-600` → `var(--color-text-disabled)`

### Border Colors
- `border-gray-800` → `var(--color-border-primary)`
- `border-gray-700` → `var(--color-border-secondary)`
- `border-blue-500` → `var(--color-border-focus)`

### Semantic Colors
- `bg-blue-600` → `var(--color-primary)`
- `bg-green-500` → `var(--color-success)`
- `bg-orange-500` → `var(--color-warning)`
- `bg-red-500` → `var(--color-error)`

## Migration Checklist

For each component:
- [ ] Replace all `bg-[#...]` with style objects
- [ ] Replace all `bg-gray-*` with style objects
- [ ] Replace all `text-gray-*` with style objects
- [ ] Replace all `border-gray-*` with style objects
- [ ] Replace all `text-white` with style objects
- [ ] Fix hover states to use onMouseEnter/onMouseLeave
- [ ] Replace date formatting with global utilities
- [ ] Verify hover ≠ selected
- [ ] Test component visually

## Automated Migration Script (Future)

A script could be created to:
1. Find all instances of hardcoded colors
2. Replace with appropriate tokens
3. Generate migration report
4. Verify no regressions

---

**Status**: Manual migration in progress
**Pattern**: Use this guide for systematic migration
