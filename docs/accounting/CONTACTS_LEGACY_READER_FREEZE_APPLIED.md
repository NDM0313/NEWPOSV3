# Legacy / duplicate readers — freeze applied

**Date:** 2026-03-29

## What was frozen (UI / copy / behavior)

1. **Contacts row tooltips** (`ContactsPage.tsx`): Removed misleading text implying **“merged documents”** for operational recv/pay. Operational columns are **`get_contact_balances_summary` only**. GL sublines explicitly reference **1100 subtree** party AR / party AP via **`get_contact_party_gl_balances`**.

2. **Reconciliation help card** (same file): Copy updated so GL side is described as **1100 subtree** roll-up, not “control-only,” matching live migration **`20260410_ar_ap_subtree_party_gl_read_parity.sql`**.

3. **Prior code freezes (do not regress):**
   - No operational fallback on RPC failure for contact row amounts (`CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md`).
   - Manual payment / manual receipt **amount edits** must post **`payment_adjustment`** with party AR/AP (`SUPPLIER_PAYMENT_EDIT_*`, `CUSTOMER_RECEIPT_EDIT_*` reports).

## What remains legacy but still in codebase

| Location | Behavior | Status |
|----------|----------|--------|
| `useAccountsHierarchyModel` | When `partyGlByContactId` is null, party rows may show **`account.balance`** | Documented as **cache**; not authoritative for party GL. |
| `AddEntryV2` | Shows warning when party GL RPC unavailable | **Not** a second source of truth — UX guard only. |
| `convertFromSupabaseContact` | Still builds contact list fields (name, phone, etc.) | Operational recv/pay **overwritten** from RPC map when present. |

## What was NOT done (safety)

- No `DROP TABLE` / `DROP FUNCTION`.
- No removal of `accounts.balance` column.
- No deletion of duplicate views until repo-wide references are proven zero.
