# ERP Bugfix: Contact Save Performance / get_contact_balances

**Date:** 2026-03-13  
**Issue:** Creating a contact works but save feels slow. Console showed repeated reloads and `get_contact_balances` (or balance RPC) 400 Bad Request errors.

---

## Root cause

1. **RPC 400:** The `get_contact_balances_summary` RPC expects `p_branch_id` as UUID or null. If the frontend passed an empty string, the string `"all"`, or an invalid value, PostgREST could return 400, causing the balance phase to fail and fall back to loading all sales and purchases (slow).
2. **Repeated reloads:** After contact save, `setCreatedContactId` triggered one `loadContacts()`. The window focus listener and dependency churn could trigger additional `loadContacts()` calls before the first finished, causing multiple in-flight requests and a sluggish feel.

---

## Fix

### 1. contactService.getContactBalancesSummary

- **Parameter validation:** Only pass `p_branch_id` when it is a valid UUID string; otherwise pass `null`. Reject empty string, `"all"`, and non-UUID values so the RPC never receives an invalid type.
- **Error handling:** On RPC error, log in dev and return `null` (caller already falls back to sales/purchases); avoid surfacing 400 as a hard failure.

### 2. ContactsPage loadContacts

- **Concurrent guard:** Use a ref `loadContactsInProgressRef` so that if `loadContacts` is invoked again while a run is in progress, the second call returns immediately. This prevents duplicate in-flight requests when contact-created effect and focus (or other effects) fire close together.
- **Finally:** Set `loadContactsInProgressRef.current = false` in the `finally` block so the guard is cleared when the run completes (success or error).

---

## Files changed

- `src/app/services/contactService.ts`: validate `branchId` (UUID or null) before calling `get_contact_balances_summary`; log RPC errors in dev.
- `src/app/components/contacts/ContactsPage.tsx`: add `loadContactsInProgressRef` and skip starting a new load when one is already in progress; clear ref in `finally`.

---

## Verification

- Create a new contact from Contacts (or GlobalDrawer): save completes without repeated full reloads; console has no 400 for the balance RPC when branch is valid or "all".
- Contacts list shows the new contact with balances (from RPC or fallback). No unnecessary duplicate network requests.

---

## Rollback

- Revert changes to `contactService.ts` and `ContactsPage.tsx`. Restore previous parameter passing and remove the in-progress ref.
