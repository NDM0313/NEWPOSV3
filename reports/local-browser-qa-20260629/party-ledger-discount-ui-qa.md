# Party Ledger Discount — non-mutating UI QA

**Generated:** 2026-06-29  
**Route:** `/reports/ledger-statement-center-v2` (Account Statements tab)

---

## Customer flow (MR JALIL)

| Check | Result |
|-------|--------|
| Select customer party | **Pass** — MR JALIL loaded |
| Customer discount button visible | **Pass** |
| Open modal | **Pass** — title "Customer discount" |
| COA summary | **Pass** — Dr 5200 Discount Allowed · Cr party AR |
| Fields present | **Pass** — amount, date, notes |
| Empty submit validation | **Pass** — "Enter a valid discount amount." |
| Modal does not post until Apply | **Pass** — closed via Cancel without posting |
| Unified preview panel | **Pass** — checkbox "Unified engine preview (compare only)" present |
| Discount transaction filter | **Pass** — option present in TRANSACTION TYPE dropdown (label truncated "Discoun" in a11y tree) |
| Filters still work | **Pass** — statement type, party, search, date range functional |

---

## Supplier flow (MR DIN MOHAMMAD)

| Check | Result |
|-------|--------|
| Switch statement type to Supplier | **Pass** |
| Select supplier | **Pass** — MR DIN MOHAMMAD |
| Supplier discount button visible | **Pass** |
| Open modal | **Pass** — title "Supplier discount" |
| COA summary | **Pass** — Dr party AP · Cr 5210 Discount Received |
| Fields present | **Pass** — amount, date, notes |
| Close without posting | **Pass** — modal dismissed |

---

## UI result

**PASS** — all non-mutating UI checks passed for customer and supplier flows.
