# GL backlog — read-only diagnostics

**Generated:** 2026-06-30  
**Mode:** SELECT only — no mutations, no repair RPCs.

## Summary

| Item | Company | GL / operational | Decision |
|------|---------|------------------|----------|
| C1 MURAD DC-0007 | DIN CHINA | GL **0**; DC-0007 **paid** | **NO_REPAIR_NEEDED** |
| C2 AZIZ JAMURAD | DIN CHINA | GL **0** / op **0** | **NO_REPAIR_NEEDED** |
| C3 ABDUL WAJID | DIN CHINA | GL **329,314** = op **329,314** | **NO_REPAIR_NEEDED** |
| C4 DIN BRIDAL 1100 | DIN BRIDAL | control **-136,500** | **REPAIR_APPROVAL_NEEDED** |

---

## C1 — MURAD DC-0007

- **Party:** MURAD RAMDAS (`AR-166142`)
- **Invoice DC-0007:** final, total 257,140, **paid in full**, due **0**
- **GL net:** 0
- **Root cause:** Open receivable item from backlog — **closed by payment** (no GL repair)
- **Operator action:** None required unless re-open dispute

---

## C2 — AZIZ JAMURAD

- **Party:** AZIZ JAMURAD (`AR-A987EE`)
- **GL net:** 0 | **Operational receivables:** 0
- **Root cause:** Prior 1100 vs party misallocation **no longer present** in current balances
- **Sample lines:** Receipts post to party AR (not control 1100) in recent data
- **Operator action:** None — monitor only

---

## C3 — ABDUL WAJID JAMURAD

- **Party:** ABDUL WAJID JAMURAD (`AR-476D3E`)
- **GL net:** 329,314 | **Operational:** 329,314
- **Root cause:** Partial mismatch from June backlog **resolved** — balances aligned
- **Operator action:** None

---

## C4 — DIN BRIDAL control 1100

- **Account:** 1100 Accounts Receivable
- **GL net:** **-136,500** (credit balance on control)
- **Root cause:** Legacy/control vs sub-ledger pattern — **business decision** required
- **Proposed dry-run (not executed):**
  1. `scripts/sql/diag_rental_1100_leakage.sql` pattern for DIN BRIDAL
  2. Party-level tie-out vs sum(sub-ledger AR)
  3. Minimal journal line account moves (RAEES repair pattern) **only after written approval**
- **Operator approval required before any apply**

---

SQL source: read-only query run on VPS `2026-06-30` (not committed — results captured above).
