# Mobile Purchase Ledger Remaining Tasks

## Current Retry (Apr 30, 2026)

- Implemented another deep fix pass in `erp-mobile-app/src/api/purchaseEditAccounting.ts` to reduce silent JE sync skips:
  - Added fallback inventory account resolution when `1200` is unavailable.
  - Added fallback AP control resolution when `2000/2100` is unavailable.
  - Improved canonical purchase JE lookup:
    - prefers latest active JE by `updated_at` for `reference_type='purchase'` + `reference_id=purchaseId`
    - fallback lookup by `description ILIKE %poNo%` when legacy data is not linked by `reference_id`.

## Why issue may still appear in some records

- Existing legacy/dirty data can still contain multiple active purchase document JEs for one purchase.
- Some historical entries may be source-linked in UI but not consistently linked in `journal_entries.reference_id`.
- Old already-wrong JEs are not auto-voided by this fix; the retry focuses on updating the best canonical target.

## Remaining Verification Tasks

- Re-test exact failing scenario:
  - Edit purchase on mobile (change lines/total).
  - Open web accounting transaction detail for the same purchase.
  - Confirm JE totals and line totals match edited purchase total.
- Capture logs for sync result (`updated`, `error`, `skipReason`) for the failing purchase id.
- If mismatch remains, run one-time data cleanup for duplicate/legacy purchase document JEs:
  - identify all active `journal_entries` with `reference_type='purchase'` grouped by `reference_id`
  - resolve duplicates by keeping canonical latest JE and voiding/archiving stale siblings.

## Next implementation candidate (if still failing)

- Add deterministic JE selector by transaction kind/source marker (instead of description heuristics).
- Add explicit server RPC for “repair purchase document JE by purchase id” and call it from mobile edit flow when sync returns `no_document_je`.
