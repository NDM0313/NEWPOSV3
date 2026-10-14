# Root Cause — Mobile Supplier Ledger List vs Detail

**Date:** 2026-09-23  
**Company audited:** DIN COLLECTION (company-wide / null branch — same as mobile list default)

## Proven facts (code)

1. **`getContacts(... supplier ...)` already calls `loadSupplierBusinessGlBalancesMap`** and overlays `Contact.balance` with Business GL when a slice exists.
2. **`PartyLedgerReport` then loads Business GL again** and overwrites `balance` a second time.
3. **Before that overwrite**, list balance is computed via `resolveContactListBalance(..., glSlice.glApPayable)` using **Official AP**:
   - For ARIF-class suppliers (`Official AP = 0`, Business ≠ 0), this path returns **0** (Official GL due is zero; then `glDue != null` returns 0 instead of preserving Business opening).
4. **`loadSupplierBusinessGlBalancesMap` initializes every supplier to `{ businessNet: 0, ... }`**.
5. On journal-line batch **catch**, it **returns that zero map** with **no error flag**.
6. Callers use `if (slice)` — which is **always true** after init — so a **failed batch overwrites valid Business balances with 0**, displayed as **Settled / Rs. 0**.

## Proven facts (data — READ ONLY)

SQL attribution (linked_contact_id + verified remaps; components `ap_2000` + `legacy_2090`; Cr−Dr; company-wide):

| Metric | Value |
|--------|------:|
| Suppliers audited | **128** |
| TRUE_ZERO (no Business lines) | **15** |
| Non-zero Business | **79** |
| Official AP = 0 but Business ≠ 0 | **59** (class B — list Official path would show 0) |
| ARIF | Business **39937** / Official **0** / **24** lines / `210017` |
| ALAM BNRS | Business = Official **1105100** / **66** lines |

At the SQL model, batch math ≡ per-contact all-time closing (**difference = 0** when load succeeds).  
Therefore UI zeros for class-B suppliers are **not** true zeros — they are **load/overwrite bugs**.

## Root cause (single sentence)

Duplicate Business GL list loading plus silent zero-map-on-error, combined with Official-AP `resolveContactListBalance` wiping Business first, makes failed or partial batch reads look like **Settled Rs. 0** for suppliers whose Detail Business closing is non-zero.

## Chosen fix

1. Batch loader returns `{ map, error, complete }` — never treat failed load as true zeros.
2. Supplier Ledger list uses **one** Business load via `getContacts` only (remove PartyLedgerReport second batch + Official resolve for suppliers).
3. On Business load failure: do **not** cache zero overlays; surface list error; offline cache may still show last good Business list.
4. Cache key version bump so stale pre-Business-GL / failed-zero caches are not reused indefinitely.
