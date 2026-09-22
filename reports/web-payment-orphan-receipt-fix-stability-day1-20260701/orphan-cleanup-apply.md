# Orphan cleanup apply

**Decision:** `SAFE_CANCEL_HIDE_BOTH_ORPHAN_RECEIPTS`  
**Applied:** 2026-07-01T15:44:30Z

| Ref | Payment voided | JE voided | GL lines created |
|-----|----------------|-----------|------------------|
| RCV-0081 | yes (`voided_at` set) | JE-0209 voided | **none** |
| RCV-0082 | yes | JE-0210 voided | **none** |

**Audit reason:** Duplicate failed web receipt retry artifact — no posted double-entry lines. Soft-hidden per operator request.

**Method:** `scripts/single-core-ledger/apply-orphan-receipt-cleanup.mjs` (service role, allowlist-only)

Raw: `orphan-cleanup-apply.json`
