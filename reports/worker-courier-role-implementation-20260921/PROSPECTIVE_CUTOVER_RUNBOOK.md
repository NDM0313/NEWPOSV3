# Prospective cutover runbook (NON-EXECUTED)

**Status:** design only — `STRATEGY_A_PROSPECTIVE_FIRST`  
**Do not execute** without separate owner approval + staging rehearsal.  
**Does not** reopen `SUPPLIER_DUAL_ACCOUNT_CLEANUP_FINAL_CLOSED`.

## Shared rules

1. Cutover timestamp `T0` (company timezone) is mandatory.  
2. No journal line with `entry_date < T0` is rewritten.  
3. Historical AP leaves remain frozen (active or inactive) for lookback.  
4. New posts after `T0` use role leaves only.  
5. Contact `type` flip is an **explicit** step at cutover — not part of schema migration.  
6. Strategy B (historical AP → role leaf reclass) remains `DEFERRED_OPTIONAL_PHASE_F`.

---

## DHL local — `SUP-ZHD-0007`

| Field | Value |
|-------|--------|
| Current type | `supplier` |
| Future type | `courier` |
| Historical leaf | existing `AP-SUPZHD0007` (frozen historical) |
| New leaf at cutover | create via `get_or_create_courier_payable_account` → `203x` with `linked_contact_id` + `contact_id` |
| Not this contact | DHL PK `SUP-ZHD-0162` / its `203x` — must remain distinct |
| New transactions ≥ T0 | courier deposit / charge / pay → `203x` |
| Old AP | remain on AP leaf; do not move lines |

**Ambiguity:** 203x is named payable but often carries debit deposits; party reports show net on the same leaf.

---

## KIRAN — `SUP-ZHD-0036`

| Field | Value |
|-------|--------|
| Current type | `supplier` |
| Future type | `worker` |
| Historical leaf | `AP-SUPZHD0036` frozen |
| New leaves at cutover | `_ensure_worker_advance_subaccount` → `WA-*`; `_ensure_worker_payable_subaccount` → `WP-*` |
| Advances ≥ T0 | Dr WA / Cr Cash |
| Bills / payments ≥ T0 | Cr/Dr WP |
| Apply advance | Dr WP / Cr WA |

---

## SHAHMIM — `SUP-ZHD-0046`

Same architecture as KIRAN.

**Historical note:** 344k opening credit ambiguity stays unresolved for Phase F; do not invent an allowlist from heuristics.

---

## Cutover checklist (future)

- [ ] Owner signs `T0` + three contact type flips  
- [ ] Staging apply migration `20260922120000_worker_courier_role_model_account_domain.sql`  
- [ ] Staging create WA/WP/203x for the three contacts only after type flip  
- [ ] Smoke: worker payment, advance apply, courier payment; supplier AP unchanged  
- [ ] Production apply migration (capability only)  
- [ ] Production flip types + create leaves at `T0`  
- [ ] Monitor JE assist multi-leaf + party GL  

**Not in checklist:** historical AP line moves, Strategy B, dual-account cleanup reopen.
