# Regression checks — Local Browser QA

**Generated:** 2026-06-29

---

## Ledger Statement Center V2

| Check | Result |
|-------|--------|
| Page loads at `/reports/ledger-statement-center-v2` | **Pass** |
| Account Statements tab active | **Pass** |
| Customer statement load | **Pass** — MR JALIL |
| Supplier statement load | **Pass** — MR DIN MOHAMMAD |
| Unified preview toggle present | **Pass** — role-gated (checkbox readonly in session) |
| Existing filters (dates, type, search, party) | **Pass** |
| Export actions (Preview, Print, PDF, etc.) | **Pass** — visible |
| Material console errors | **None observed** |

---

## Scope exclusions confirmed

| Item | Status |
|------|--------|
| Cash Flow loader swap | **Not performed** |
| Feature flag toggle | **Not performed** |
| VPS deploy | **Not performed** |
| Migrations | **Not performed** |

---

## Regression result

**PASS** — no regressions observed in Ledger V2 during authenticated QA session.
