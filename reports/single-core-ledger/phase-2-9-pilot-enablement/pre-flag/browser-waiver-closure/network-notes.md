# Network — Ledger V2 toggle OFF (not captured)

**Status:** HAR not captured — preview UI not deployed on production ERP; no authenticated session.

**Expected behavior (feature branch code):**

- `loadUnifiedPreview` in `LedgerStatementCenterV2Page.tsx` returns early when `!unifiedPreviewEnabled`
- No `get_unified_party_ledger` / `get_unified_account_ledger` until toggle ON

**DevTools filter when re-run:** `get_unified`

**Action:** Ops captures HAR or screenshot of Network tab with toggle OFF after preview deploy.
