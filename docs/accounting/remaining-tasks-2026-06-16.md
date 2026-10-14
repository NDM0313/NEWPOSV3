# Remaining tasks — 16 Jun 2026

**Latest session doc:** [`2026-06-16-tb-reports-balance-date-sync.md`](2026-06-16-tb-reports-balance-date-sync.md)

**Prior backlog:** [`remaining-tasks-2026-06-14.md`](remaining-tasks-2026-06-14.md)

**Sync status (16 Jun 2026):** Local + VPS at `main` **`3136cad7`**. RAEES GL repair applied on VPS DB. `erp-frontend` healthy at https://erp.dincouture.pk.

---

## Completed today (16 Jun) — TB / Reports

| Item | Status | Note |
|------|--------|------|
| RAEES LHR GL orphan (600k on TB) | **Done** | 3 payment lines moved 1100 → AR-11D58D |
| Reports date-filter sync (Balance Sheet, remount key) | **Done** | `3136cad7` |
| TB column label **Period net (Dr−Cr)** | **Done** | `3136cad7` |
| Diag SQL for RAEES / MURAD | **Done** | `scripts/sql/diag_raees_murad_balance_tieout.sql` |

---

## Open — accounting / GL (priority)

### MURAD RAMDAS — business action

- [ ] **DC-0007** open for **257,140** — record payment or adjust/cancel if not truly owed
- [ ] Re-check TB + party statement after payment

### Legacy 1100 → party sub-ledger (DIN CHINA import pattern)

Diag (16 Jun) also flagged other customers with GL ≠ operational:

| Contact | GL net (diag) | Operational receivables | Action |
|---------|---------------|-------------------------|--------|
| AZIZ JAMURAD | 755,500 | 0 | Investigate payments crediting 1100 vs party account |
| ABDUL WAJID JAMURAD | 429,314 | 329,314 | Partial mismatch — tie-out + targeted repair |

- [ ] Run `diag_raees_murad_balance_tieout.sql` pattern for AZIZ / ABDUL WAJID (extend name filter or new script)
- [ ] Apply **minimal** line-level account moves (same pattern as RAEES) — dry-run + audit per contact
- [ ] Reconcile control **1100** balance vs sum(party AR) after batch

### Control 1100 (DIN BRIDAL / other companies)

- [ ] Control 1100 **-136,500** (DIN BRIDAL) — business decision (from 14 Jun backlog)

---

## Open — verify in UI (post-deploy)

### Reports

- [ ] Change header date on **Balance Sheet** — data reloads immediately
- [ ] Change header date on **Trial Balance**, **P&L**, **Customers & Suppliers** — data reloads
- [ ] RAEES row in TB / Balance Basis Guide shows **0.00**
- [ ] MURAD row shows **257,140** until DC-0007 paid
- [ ] Product Reports pie overlap — not re-checked (14 Jun)
- [ ] Customers & Suppliers **Due (GL)** / **Advance (GL)** — full table QA

### Rentals (14 Jun backlog)

- [ ] **REN-0005 / Amount Due KPI:** July pickup **15,000** vs list filter; KPI **Amount Due** still **Rs. 0.00**
- [ ] Sales / Purchases / Inventory KPI strips — not spot-checked

### Expenses

- [ ] End-to-end receipt upload + edit-without-duplicate — no new test EXP posted

---

## DIN CHINA legacy import (unchanged from 14 Jun)

- [ ] Phase 2 COGS: 12 products missing `cost_price`
- [ ] Phase 3 purchase total vs CSV delta (~Rs 464,071) — business approval
- [ ] Phase 6 sell returns — optional
- [ ] Opening balance / fabric stock from Oct 2023 — excluded by design

---

## Mobile

- [ ] Rental AR sub-ledger on mobile booking flow
- [ ] APK rebuild if needed

---

## Optional / hygiene

- [ ] Optional: `scripts/cleanup-duplicate-expenses.sql` — review SELECT before APPLY
- [ ] Optional TB toggle: **Closing balance as of end date** (cumulative through `endDate`) — follow-up UX
