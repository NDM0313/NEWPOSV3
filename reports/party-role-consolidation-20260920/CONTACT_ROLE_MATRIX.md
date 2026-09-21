# Contact × role matrix — DIN COLLECTION (read-only forensic 2026-09-20)

**Company:** `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Production:** `https://erp.dincouture.pk` / DB `postgres`  
**IBRAHIM:** CLOSED — do not touch `backup_coa_limited_ibrahim_v1`  
**Verdict (package):** see `PRODUCTION_EXECUTION_PLAN.md`

## Owner-binding roles

| Contact | Code | Contact UUID | DB `contacts.type` today | Canonical role | Merge rule |
|---------|------|--------------|--------------------------|----------------|------------|
| ID LACE | SUP-ZHD-0027 | `d681fcf5-…` | `supplier` | **Supplier** | — |
| KIRAN MUKESH | SUP-ZHD-0036 | `797ca8bb-…` | `supplier` (wrong) | **Worker / artisan** | — |
| SHAHMIM NAZ | SUP-ZHD-0046 | `f902a1f8-…` | `supplier` (wrong) | **Worker / artisan** | — |
| DHL | SUP-ZHD-0007 | `6ce5bed0-…` | `supplier` (wrong) | **Courier** | ≠ DHL PK |
| DHL PK | SUP-ZHD-0162 | `4505905b-…` | `supplier` (wrong) | **Courier** | ≠ DHL |

## Schema support (native)

Postgres `contacts.type` enum already includes: `customer | supplier | both | worker | courier | money_exchange`.

| Role | Enum | Subledger service | Unified ledger `party_type` | Customers & Suppliers report |
|------|------|-------------------|------------------------------|------------------------------|
| Supplier | `supplier` | `resolvePayablePostingAccountId` → **2000 / AP-*** | `supplier` | supplier filter |
| Worker | `worker` | `resolveWorkerPayablePostingAccountId` → **2010 / WP-*** (+ **1180**) | `worker` | **included in supplier filter today** (gap) |
| Courier | `courier` | `get_or_create_courier_payable_account` → **203x** | **not supported** | **excluded** |

**Master-data design (no fake supplier):** flip `contacts.type` to `worker` / `courier` where confirmed — **preserve contact UUID**. No delete/recreate. Couriers may also need a `couriers` row if Settings courier UX is used (additive).

## Canonical GL intent

| Role | Control | Leaf pattern |
|------|---------|--------------|
| Supplier | 2000 | `AP-SUP*` |
| Worker advance | 1180 | `WA-*` (create if missing) |
| Worker payable | 2010 | `WP-*` (create if missing) |
| Courier | 2030 | `203xxxx` via courier RPC |

## Split history finding (critical)

Legacy `210027 / 210007 / 210036 / 210046` are **inactive with 0 journal lines**. History already lives on `AP-SUP*` (Sept merge + remaps). Remaining problem is **wrong control family / contact type**, not leftover IBRAHIM-style dual lines on 210xxx for these five (except DHL PK’s dual **2030162 + AP-SUPZHD0162**).

Verified remaps already present: `210027→AP-SUPZHD0027`, `210007→AP-SUPZHD0007`, `210036→AP-SUPZHD0036`, `210046→AP-SUPZHD0046`.
