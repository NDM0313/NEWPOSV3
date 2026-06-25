# Phase 2.9A-4 — Network notes

**URL:** http://localhost:3002 (SSH tunnel → VPS :3003)  
**Timestamp (UTC):** 2026-06-25  

## Automated smoke (unauthenticated)

| Check | Result |
|-------|--------|
| Preview HTTP 200 | PASS |
| Login page (email + Sign In) | PASS |
| CORS preflight `Origin: http://localhost:3002` → `access-control-allow-origin` | PASS (Kong patched 2026-06-25) |

## Authenticated HAR (toggle OFF / ON)

**Status:** NOT CAPTURED — agent run had no `QA_BROWSER_PASSWORD`; operator must capture DevTools Network filtered on `get_unified` after admin login.

### Expected (from code)

| Toggle | Expected network |
|--------|------------------|
| OFF | No `get_unified_party_ledger` / `get_unified_account_ledger` for Ledger V2 main load |
| ON + Load MR JALIL | `get_unified_party_ledger` (preview panel only) |

Reference: `LedgerStatementCenterV2Page.tsx` — `unifiedPreviewEnabled` gates preview loader.
