# FINAL_RESULT — Mobile Supplier Ledger List/Detail Parity

**Date:** 2026-09-23  
**Branch:** `fix/mobile-supplier-list-detail-parity`  
**Branch tip:** `bd8d73af44ba19da3dad76235fdedf36ce6eda45`  
**Base main:** `d84430b4d9d81262ba3549eb4ee405fd9cd708e9`  
**Verdict:** `MOBILE_SUPPLIER_LIST_DETAIL_PARITY_READY_FOR_OWNER_REVIEW`

## Root cause

Duplicate Business GL batch on Supplier list (`getContacts` + `PartyLedgerReport`) plus silent zero-map-on-error, combined with Official-AP `resolveContactListBalance` wiping Business first for class-B suppliers (Official AP = 0, Business ≠ 0). Failed/partial batch reads presented as Settled Rs. 0 while Detail all-time Business closing remained correct.

## Fix (Option A — smaller/safer)

1. **One** Business batch per Supplier list refresh: `PartyLedgerReport` trusts Business-overlaid `Contact.balance` from `getContacts`; second batch + Official resolve removed for suppliers.
2. Batch loader returns `{ map, error, complete, meta }`. On failure: empty map + `complete: false` (never all-zero success).
3. `getContacts`: apply Business overlay only when `complete === true`; on incomplete, do **not** cache Official/zero overlays — return last good `ct:v2biz` cache with error, or hard error with empty list.
4. Cache key bump `ct:` → `ct:v2biz:` so stale pre-Business / failed-zero caches are not reused indefinitely.
5. List/detail semantics unchanged: `ap_2000` + `legacy_2090`, Cr−Dr, linked_contact_id + verified remaps, worker/courier excluded, company-wide null branch same as detail all-time.

## Audit (READ ONLY)

| Metric | Before (UI risk) | After (successful load) |
|--------|------------------|-------------------------|
| Suppliers audited | 128 | 128 |
| Data-level list≡detail mismatches | 0 | 0 |
| TRUE_ZERO | 15 | 15 |
| PARITY (incl. non-zero) | 113 | 113 |
| Class B (Official 0 / Business ≠ 0) | 59 | 59 (list now shows Business) |
| LOAD_ERROR at SQL audit | 0 | 0 |
| UI LIST_ZERO_DETAIL_NONZERO path | Present (silent zero / Official wipe) | **Removed** |

Golden:

| Supplier | List Business | Detail all-time Business | Official AP | Lines | Source |
|----------|--------------:|-------------------------:|------------:|------:|--------|
| ARIF LHR | 39937 | 39937 | 0 | 24 | includes 210017 |
| ALAM BNRS | 1105100 | 1105100 | 1105100 | 66 | — |

## Checklist

| Item | Result |
|------|--------|
| Duplicate Business batch removed | **YES** |
| Silent-zero-on-error removed | **YES** |
| Branch semantics | company-wide / null (list = detail all-time) |
| Cache | `ct:v2biz`; success replaces cache; fail keeps last good |
| Database mutations | **0** |
| Migrations | **NONE** |
| JEs / account_ids / TB / BS | unchanged |
| Graphify | **NO** |
| Main merged | **NO** |
| Device tested | **NO** |

## Builds

| Check | Result |
|-------|--------|
| `npx tsx --test` supplierBusinessGl + supplierListDetailParity | **10 PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:mobile` | **PASS** |
| APK generated | **NO** |
| Device tested | **NO** |
