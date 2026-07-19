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

### Task A — Account balance mismatches (2 rows)

Lab H showed **Account mismatches = 2** under:

> Account balance vs journal (safe repair: sync from journal)

Observed diffs (home DOM): **105350** and **-40200** (one account row starts **5010 CO…**).

These are **cached `accounts.balance` vs journal totals**, not Trial Balance imbalance (TB is already 0).

**Fix on production (office):**

1. Open Lab H (path above) → **Load detection**
2. Confirm still **Account mismatches = 2** (or list the two rows)
3. Click **Sync account balances from journal**
4. Reload detection → expect **Account mismatches = 0**

**Notes:**

- Does **not** invent journal entries
- Does **not** change TB (already 0)
- Sync ≠ TB fix (see admin self-fix doc)

### Task B — AR vs receivables (separate)

Lab H showed **AR vs receivables = −1,382,450**.

- **Do not** treat this as TB imbalance
- **Do not** expect Task A sync button to clear this gap
- Investigate on office PC (document due vs AR journal) as a separate AR/receivables reconciliation task

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

Then complete Task A (and schedule Task B). Hard-refresh ERP if Lab H / deep-link buttons missing after VPS deploy.
