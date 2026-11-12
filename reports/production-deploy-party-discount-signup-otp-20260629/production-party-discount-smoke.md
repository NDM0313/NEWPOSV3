# Production Party Ledger Discount smoke (UI only)

**Generated:** 2026-06-29  
**URL:** https://erp.dincouture.pk/reports/ledger-statement-center-v2

---

## Customer flow

| Check | Result |
|-------|--------|
| Party selected | Walk-in Customer (QA Test Business Mac — MR JALIL not in this company) |
| Customer discount button | **Pass** — visible when party selected |
| Modal opens | **Pass** — "Customer discount" |
| COA summary | **Pass** — Dr 5200 · Cr party AR |
| Empty amount validation | **Pass** — "Enter a valid discount amount." |
| Closed without posting | **Pass** — Cancel |
| Discount filter visible | **Pass** |
| Unified preview panel | **Pass** |

---

## Supplier flow

| Check | Result |
|-------|--------|
| Supplier party available | **Skipped** — no supplier contacts in QA test company |
| Supplier discount modal | **Not exercised** on production (no supplier party) |

---

## Mutation checks

| Check | Result |
|-------|--------|
| JE posted | **No** |
| `party_discount` rows | **0** (verified post-smoke) |
| Statement reload | Unchanged (no post) |

---

## Result

**PARTIAL PASS** — customer discount UI verified on production; supplier flow not exercised (no supplier in test company). DIN CHINA parties (MR JALIL / MR DIN MOHAMMAD) require operator production credentials.
