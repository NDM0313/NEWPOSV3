# ERP Save Button — Duplicate Save Protection

## Requirement

Once Save is pressed:

- Button becomes disabled and shows loading.
- Duplicate clicks are ignored (only one active save at a time).
- Same behavior for normal sale save, Save & Print, and POS “Proceed to Payment”.

## Implementation

### Normal sale (SaleForm)

**File: `src/app/components/sales/SaleForm.tsx`**

- **Ref guard:** `saveInProgressRef.current` is set to `true` at the start of `proceedWithSave` and reset to `false` in a `finally` block. The first line of `proceedWithSave` is `if (saveInProgressRef.current) return null;` so a second call exits immediately.
- **UI state:** `saving` is set to `true` at the start and `false` in `finally`. Both “Save” and “Save & Print” use `disabled={saving}` and show “Saving...” / “Updating...” while true.
- **Early returns:** All early-exit paths (e.g. “Please select a branch”, “No branch available”) now set `saveInProgressRef.current = false` and `setSaving(false)` before returning, so the next save is not permanently blocked.

### POS (POS.tsx)

**File: `src/app/components/pos/POS.tsx`**

- **Ref guard:** `posSaveInProgressRef.current` is set to `true` at the start of `handleProceedToPayment` and reset in a `finally` block. The handler returns immediately if `posSaveInProgressRef.current` is already true.
- **UI state:** `posSaveInProgress` state is set true/false with the ref. The “Proceed to Payment” button is `disabled={... || posSaveInProgress || ...}` and shows “Creating sale...” with a spinner when `posSaveInProgress` is true.
- **Stock validation early return:** When stock check fails, we set the ref and state to false before returning so the button is not stuck.

## Flow

1. User clicks Save (or Save & Print / Proceed to Payment).
2. Ref is set true, loading state is set → button disabled and label changes.
3. If validation fails (e.g. branch), ref and state are cleared and we return; user can try again.
4. Otherwise the create/update runs; on completion or error, `finally` clears ref and state.
5. A second click while the first request is in flight does nothing (ref guard) and the button stays disabled (UI state).

## Verification

- **Case D:** Normal sale → click Save once during slow network → only one sale created; button stays disabled until done.
- **Case E:** Rapid multiple clicks on “Proceed to Payment” in POS → only one POS sale created; button shows “Creating sale...” and ignores extra clicks.

## Rollback

- SaleForm: Remove `saveInProgressRef.current = false` from the two early-return branches (and optionally the ref guard at the top of `proceedWithSave`).
- POS: Remove `posSaveInProgressRef`, `posSaveInProgress` state, and the guard/finally/disabled and loading UI in `handleProceedToPayment` and the button.

---

## Global async action lock (web + mobile)

Use this for **any** button that loads, saves, posts, reverses, voids, or downloads data—not only Save.

### Providers

| Client | File | Root wrap |
|--------|------|-----------|
| Web | `src/app/context/LoadingContext.tsx` | `LoadingProvider` in `src/app/App.tsx` |
| Mobile | `erp-mobile-app/src/contexts/LoadingContext.tsx` | `LoadingProvider` in `erp-mobile-app/src/main.tsx` |

### API

- **`useSubmitLock()`** — preferred for click handlers:
  - `run(label, async () => { ... })` — ref mutex + full-screen overlay; second tap is ignored.
  - `busy` — pass to `disabled={busy}` on **all** actionable controls on the same surface (siblings too, not only the clicked button).
- **`useLoading().withLoading(label, task)`** — when you only need the overlay without a button guard.

### Rules

1. Do **not** fire mutations with bare `void someAsyncFn()` on buttons.
2. While `busy`, disable every action on that page/modal row (View, Edit, Reverse, row click, etc.).
3. Confirm dialogs run **inside** `run()` after the lock is taken so double-click cannot queue two confirms.
4. Page-local `saving` / `isProcessing` state is fine for button labels; still use `useSubmitLock` for overlay + mutex where duplicate taps cause duplicate posts.

### Reference implementations

- Web accounting journal table: `src/app/components/accounting/AccountingDashboard.tsx` (`runJournalMutation`, `busy` on View/Edit/Reverse/row click).
- Web transaction detail: `src/app/components/accounting/TransactionDetailModal.tsx` (Reverse, Void, Save Changes).
- Mobile saves: `useSubmitLock` in flows such as `CreateRentalFlow`, `PaymentDialog`, `ProductsModule`.

### Verification

1. Accounting → journal row → **Reverse** once on slow network → overlay visible; View/Edit/Reverse and row click inactive until done.
2. Rapid double-click Reverse → only one reversal JE.
