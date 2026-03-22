# Phase 5 — Real party signoff (template)

## Rules

- **No blended unlabeled numbers** on any surface: operational, GL, reconciliation, and control slices must be explicitly labeled (UI badges / section titles).
- **Mismatch** must have a **labeled cause** (e.g. timing, unmapped GL line, RPC unavailable, `pending_mapping`, legacy payment without JE).
- If unresolved, mark **`pending_mapping`** (or equivalent diagnostic) — **do not** hide the gap.

## Parties to validate

Fill identifiers from your tenant:

| Party | `contact_id` (UUID) | Notes |
|-------|---------------------|--------|
| Walk-in Customer | | Default / `walking_customer` |
| CUSTOMER 01 | | Named retail customer |
| Supplier (one) | | Supplier or both |
| Worker (one) | | `type = worker` |

## Surfaces (per party)

For each party, record **Pass** / **Fail** / **Pending** and a **one-line labeled cause** for any Fail or Pending.

| # | Surface | What to compare |
|---|---------|------------------|
| 1 | **Contacts list row** | Operational receivable or payable only; amber mismatch = operational vs party GL slice, not replacement of the row amount. |
| 2 | **Operational statement** | Open-document / subledger basis (`get_contact_balances_summary` family); matches Contacts intent. |
| 3 | **GL statement** | Journal-attributed activity; party GL tab / lines. |
| 4 | **Reconciliation statement** | Variance and explanations; no silent merge with operational. |
| 5 | **Party tie-out panel** | `PAYMENT_WITHOUT_JE`, weak links, worker lifecycle warnings — must be explicit. |
| 6 | **Integrity Lab** | RULE_08 / payment / document anomalies for that party’s company scope. |
| 7 | **Control account drawer party slice** | Row amounts are **GL** (party-attributed from `get_contact_party_gl_balances`); drill to party statement. |

## Signoff matrix

### Walk-in Customer

| Surface | Result | Cause / evidence |
|---------|--------|--------------------|
| 1 Contacts row | | |
| 2 Operational stmt | | |
| 3 GL stmt | | |
| 4 Reconciliation | | |
| 5 Tie-out | | |
| 6 Integrity Lab | | |
| 7 Control drawer | | |

### CUSTOMER 01

| Surface | Result | Cause / evidence |
|---------|--------|--------------------|
| 1–7 | | |

### Supplier

| Surface | Result | Cause / evidence |
|---------|--------|--------------------|
| 1–7 | | |

### Worker

| Surface | Result | Cause / evidence |
|---------|--------|--------------------|
| 1–7 | | |

## Overall Phase 5 outcome

- **Signed off:** ☐ Yes ☐ No  
- **Blocking items (if any):**  
- **Owner / date:**  

---

*This document is a run template. Execution is on your Supabase tenant and app build; replace placeholder results after QA.*
