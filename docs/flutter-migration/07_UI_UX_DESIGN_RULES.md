# 07 — UI / UX Design Rules

Flutter should match the **existing mobile ERP dark theme** and salesman-friendly flows from [`erp-mobile-app/src/components/`](../../erp-mobile-app/src/components/).

## Visual theme

**Dark-first** (no light-mode toggle in Capacitor app today).

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#111827` | Screen backgrounds |
| Surface / inputs | `#111827` + border `#374151` | Form fields |
| Primary accent | `#3B82F6` | Buttons, links, spinners |
| Muted text | `#9CA3AF`, `#6B7280` | Secondary labels |
| Success | `#10B981` | Purchase module accent |
| Error | `#EF4444` | Expense accent, errors |

Module card colors on [`HomeScreen.tsx`](../../erp-mobile-app/src/components/HomeScreen.tsx): per-module accent (sales blue, purchase green, rental purple, studio pink, etc.).

Reference exports (visual only, not code):

- [`mobile-design/`](../../mobile-design/)
- [`Figma Mobile ERP App Design/`](../../Figma%20Mobile%20ERP%20App%20Design/)

## Layout breakpoints

From [`hooks/useResponsive.ts`](../../erp-mobile-app/src/hooks/useResponsive.ts):

| Breakpoint | Behavior |
|------------|----------|
| `< 768px` | Mobile — bottom nav, 2-column module grid |
| `>= 768px` | Tablet — [`TabletSidebar.tsx`](../../erp-mobile-app/src/components/TabletSidebar.tsx), 3–4 column grids |

Flutter: `LayoutBuilder` with `TABLET_BREAKPOINT = 768`.

## Navigation shell

### Bottom navigation ([`BottomNav.tsx`](../../erp-mobile-app/src/components/BottomNav.tsx))

Tabs: `home`, `sales`, `pos`, `contacts`, `more`

- **More** opens module grid ([`ModuleGrid.tsx`](../../erp-mobile-app/src/components/ModuleGrid.tsx))
- Permission-filtered module list

### App flow

```
Login → Branch selection → Home
         ↓
    Module screens (full-screen stack)
         ↓
    Back gesture / header back ([mobileBackPress.ts](../../erp-mobile-app/src/lib/mobileBackPress.ts))
```

### Branch selector

- [`BranchSelection.tsx`](../../erp-mobile-app/src/components/BranchSelection.tsx)
- Admin: all branches + optional "all" behavior via [`branchResolution.ts`](../../erp-mobile-app/src/lib/branchResolution.ts)
- Locked branch users: skip selector when `user.branchLocked`
- Persist: `erp_mobile_branch` localStorage key in `App.tsx`

## POS / sales UX rules

1. **Large tap targets** — product grid cards, full-width action buttons
2. **Numeric keypad-friendly** — [`NumpadInput.tsx`](../../erp-mobile-app/src/components/common/NumpadInput.tsx), [`PinNumericInput.tsx`](../../erp-mobile-app/src/components/common/PinNumericInput.tsx)
3. **Simple POS flow** — product grid → cart drawer → checkout → payment → confirmation
4. **Tax** — POS uses company tax settings (16% mentioned in README for POS module)
5. **Walk-in default** — customer name defaults to Walk-in when no customer selected
6. **Barcode** — prominent Scan action on POS ([`BarcodeCameraModal.tsx`](../../erp-mobile-app/src/components/sales/BarcodeCameraModal.tsx))

## Forms and inputs

- [`config/inputConfig.ts`](../../erp-mobile-app/src/config/inputConfig.ts) — field behavior
- [`utils/inputKeyboard.ts`](../../erp-mobile-app/src/utils/inputKeyboard.ts) — keyboard type hints
- [`utils/numericValidation.ts`](../../erp-mobile-app/src/utils/numericValidation.ts) — amount validation
- [`components/common/TextInput.tsx`](../../erp-mobile-app/src/components/common/TextInput.tsx), [`CustomSelect.tsx`](../../erp-mobile-app/src/components/common/CustomSelect.tsx)

Flutter: use `TextInputType.numberWithOptions(decimal: true)` for money fields; minimize text keyboard on POS.

## Loading, error, and empty states

| Component | When |
|-----------|------|
| Module loading spinner | Lazy module load ([`ModuleLoadingFallback`](../../erp-mobile-app/src/App.tsx)) — dark bg + blue spinner |
| Permission loading | "Loading permissions..." on HomeScreen |
| [`OfflineBanner.tsx`](../../erp-mobile-app/src/components/common/OfflineBanner.tsx) | `navigator.onLine === false` |
| [`SyncStatusBar.tsx`](../../erp-mobile-app/src/components/SyncStatusBar.tsx) | Pending sync count; tap to retry |
| [`AccessDenied.tsx`](../../erp-mobile-app/src/components/AccessDenied.tsx) | Module permission denied |
| [`ScreenErrorBoundary.tsx`](../../erp-mobile-app/src/components/ScreenErrorBoundary.tsx) | Module crash isolation |
| [`BootErrorBoundary.tsx`](../../erp-mobile-app/src/lib/BootErrorBoundary.tsx) | Boot failure |

Empty lists: show icon + short message + primary action (e.g. "Add contact").

## Role-based UI hiding

Gate before render (not only disable):

- Module grid cards — `hasPermission('{module}.view')` + `isModuleEnabled(screen)`
- Financial balances on home — `canViewBalances` / manager+ only
- Accounts full features — `canUseFullAccounting`
- Customer/supplier ledger tabs — `canViewCustomerLedger`, `canViewSupplierLedger`
- Studio list scope — `shouldScopeStudioToOwnOnly`

Settings rows for admin-only features hidden for salesman.

## Counter / PIN UX

- [`POSLockScreen.tsx`](../../erp-mobile-app/src/components/auth/POSLockScreen.tsx) — full-screen lock
- [`CounterLoginPanel.tsx`](../../erp-mobile-app/src/components/auth/CounterLoginPanel.tsx) — worker PIN entry
- Inactivity re-lock: [`pinLock.ts`](../../erp-mobile-app/src/lib/pinLock.ts)
- Show effective worker name on home header ([`useEffectiveWorkerProfile`](../../erp-mobile-app/src/context/CounterWorkerContext.tsx))

## Native shell polish

[`nativeShell.ts`](../../erp-mobile-app/src/lib/nativeShell.ts):

- StatusBar styling
- Safe area CSS vars for notches
- Splash screen hidden after first paint (`main.tsx`)

Flutter: `SafeArea`, `SystemChrome.setSystemUIOverlayStyle`.

## Pull to refresh

[`PullToRefresh.tsx`](../../erp-mobile-app/src/components/common/PullToRefresh.tsx) on list screens — Flutter `RefreshIndicator`.

## Dark mode policy for Flutter v1

Match Capacitor: **dark theme only** unless product requests light theme later. Use `ThemeData.dark()` with custom color scheme matching tokens above.

## Salesman-friendly principles

1. Minimize navigation depth for daily tasks (POS, new sale, add payment)
2. Show branch name and worker name in header
3. Avoid showing GL account codes to salesman
4. Use plain language ("Receive payment" not "record_payment_with_accounting")
5. Confirm destructive actions (void, cancel sale) with reason field where required by RPC
