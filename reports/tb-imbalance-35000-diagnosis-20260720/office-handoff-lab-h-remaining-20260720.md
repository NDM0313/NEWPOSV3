# Office handoff — Lab H remaining (2026-07-20)

**From:** Home Mac  
**For:** Office PC (after `git pull origin main`)  
**Company context:** DIN BRIDAL Lab H session (home evidence)

Related: [`admin-self-fix-tb-imbalance.md`](./admin-self-fix-tb-imbalance.md)

---

## Where is Lab H?

**Lab H = Accounting Integrity Lab → tab `H · Live TB repair`**

It is **not** a tab inside Accounting Developer Center.

| Surface | Lab H? |
|---------|--------|
| Accounting Developer Center | No — header button **Live TB repair** deep-links here |
| AR/AP Diagnostics & Repair hub | No — header **Live TB repair (Lab H)** deep-links here |
| **Accounting Integrity Lab** | **Yes — last tab H** |

### Paths

1. Sidebar → **Accounting Integrity Lab** → **H · Live TB repair**
2. Or Developer Center / AR-AP hub → **Live TB repair** (sets `sessionStorage erp-integrity-lab-tab=live_tb`)
3. Or Tie-out → amber TB difference → **Open Live TB repair**

---

## Done at home (do not redo)

- DIN BRIDAL TB **−35,000** root cause diagnosed and fixed in production GL (JE-0222 / JE-0247 class issues)
- Admin **Live TB repair** UI shipped (Preview / Fix for `sale` + `sale_reversal`)
- Discoverability links + this handoff pushed / VPS frontend deployed
- Lab H snapshot after TB work:
  - **TB difference = 0**
  - **Unbalanced JEs = 0**
  - **Σ JE diffs = 0**

---

## Office remaining

### Task A — Account balance mismatches — **DONE 2026-07-20 (office)**

Lab H / journal sync applied on production DIN BRIDAL:

- Pre mismatches: **15** (live had more than the 2 seen at home)
- Updated: **15** `accounts.balance` rows from journal (voided excluded)
- Post mismatches: **0**
- TB Σ still **0**
- Evidence: [`lab-h-task-a-complete-20260720.md`](./lab-h-task-a-complete-20260720.md)

### Task B — AR vs receivables (separate) — **DONE 2026-07-20 (office investigation)**

Lab H showed **AR vs receivables = −1,382,450**.

**Result:** Explained as **EXPECTED_METRIC_GAP** — final sales due (**329,000**) vs full AR GL (**1,711,450**) which includes `opening_balance_contact_ar` (**+2,382,950**) + rentals + receipts. **Not** a TB defect. **No GL mutation.**

Evidence: [`lab-h-task-b-complete-20260720.md`](./lab-h-task-b-complete-20260720.md)

---

## Do not (either machine)

- Migrations / destructive ALTER / DROP for this handoff
- Suspense balancing JE to “force” TB (TB is already 0)
- R8 / Play Store / commit IPA or `erp-mobile-app/releases/`
- Re-run sale/sale_reversal JE rebuild unless new unbalanced JEs appear

---

## After office pull

```bash
git checkout main
git pull origin main
```

Then complete Task A and Task B (both done 2026-07-20 office). Hard-refresh ERP if Lab H / deep-link buttons missing after VPS deploy.
