# AR/AP Reconciliation Center + Accounting Dashboard — analysis (screenshot-based)

This note answers: **kya ye sahi hai?** (Is this correct?), **kya missing hai?** (What is missing?), and **why two screens can look contradictory** without being a posting bug.

Related implementation docs: [`AR_AP_RECONCILIATION_CENTER.md`](./AR_AP_RECONCILIATION_CENTER.md), [`FINAL_ACCOUNT_FLOW_VISIBILITY_AND_EFFECTIVE_MODE_STABILIZATION.md`](./FINAL_ACCOUNT_FLOW_VISIBILITY_AND_EFFECTIVE_MODE_STABILIZATION.md).

---

## 1. TL;DR (Urdu + English)

| Observation | Verdict |
|-------------|---------|
| **Variance Rs. 0** on receivables/payables **but** **2 unmapped JEs** | **Expected.** Aggregate operational vs GL control can match while **line-level** party mapping still fails for some journal lines. |
| **“No display reference found”** on unmapped rows | **By design** in the current resolver: many rows still show a **JE badge** (e.g. JE-0065), but **`documentResolved`** is false when no sale/purchase/payment row resolves to a friendly invoice/ref string. |
| **Accounting dashboard: RECEIVABLES Rs. 0** vs **sidebar: ~345k party GL / TB** | **Usually not a single “wrong number” bug** — the **top card** and the **control-account breakdown** use **different formulas and data slices** (see §3). |

---

## 2. AR/AP Reconciliation Center — is the page “correct”?

### 2.1 Variance zero vs unmapped count &gt; 0

The Integrity Lab combines:

- **Operational totals** — from Contacts-oriented sources / RPCs (full subledger picture).
- **GL control totals** — AR/AP as seen on control accounts (snapshot / audit views).

**Variance** compares those **headline totals**. **Unmapped** counts come from **`v_ar_ap_unmapped_journals`**: journal **lines** on AR/AP (or related buckets) that the reconciliation layer flags when **party/contact mapping heuristics** do not tie the line cleanly to a contact.

So you can have:

- **No variance** at the control level (totals agree), and  
- **Non-zero unmapped** (specific JEs still need review, relink, or manual clearing).

That is **consistent** with the architecture in `AR_AP_RECONCILIATION_CENTER.md` (exception queues are **not** the same metric as variance).

### 2.2 “No display reference found” (amber line under the document cell)

UI component: `AccountingRefDisplayCell` — shows the amber hint when `AccountingUiRef.documentResolved === false`.

Resolution logic: `resolveJournalUiRefsByJournalIds` in `accountingDisplayRefResolver.ts` → `buildUiForJournal`. **`documentResolved: true`** is returned when a **known `reference_type`** can be joined to a **source row** and a human label is produced (sale number, purchase number, payment `reference_number`, etc.).

**Types that fall through to `unresolved()`** (and thus **`documentResolved: false`**) include, among others:

- **`journal`** (generic manual entry) — you may still see **JE-0065** as `entryNoBadge`, but no invoice/payment string.
- **`correction_reversal`** — technical `correction_reversal:uuid` display; no dedicated branch in `buildUiForJournal` maps it to a business document, so the UI correctly flags **unresolved** even if the JE number is visible.

So the screenshot rows (**JE-0065**, **correction_reversal … JE-0049**) are **expected** to show **“No display reference found”** until product work adds richer labels for those `reference_type` values **or** operators open the journal and trace via Truth Lab / Integrity tools.

### 2.3 What is “missing” on this page (product / ops)

- **Clearer copy** next to **Unmapped AR + Supplier AP JEs**: e.g. “Totals can still match; unmapped = **line-level** mapping gaps.”
- **Optional** deep link: “Why variance ≠ unmapped?” tooltip or link to this doc.
- **Resolver enhancement**: treat `correction_reversal` / PF-14 chains so `displayRef` can show parent payment or target document when metadata exists (read-only UX; **no posting change** required for display-only fixes).

---

## 3. Accounting dashboard — RECEIVABLES card vs control sidebar

### 3.1 Top summary card (RECEIVABLES)

Implemented in `AccountingDashboard.tsx`: **`totalReceivable = Math.max(0, arDebit - arCredit)`** where `arDebit` / `arCredit` accumulate amounts on journal lines whose **debit or credit account** is in the **AR account set** (`AR_ACCOUNTS`), iterating **`accounting.entries`** (the in-context journal feed).

Implications:

- Net is **floored at zero**. If, for the **loaded set of entries**, **credits on AR ≥ debits**, the card shows **Rs. 0.00** even when **party subledgers** still show large **receivable** balances under different definitions.
- Scope (branch, date, which entries are loaded into `accounting.entries`) may **differ** from **life-to-date** party GL or **operational** Contacts balances.

So **Rs. 0.00 on the card** alongside **345,001** in a **breakdown sidebar** is often **a definition / scope mismatch**, not proof that GL is “zeroed.”

### 3.2 Subcategory breakdown / residual (e.g. Accounts Receivable 1100)

Implemented in `controlAccountBreakdownService.ts` and related RPCs:

- **Party-attributed AR** — sum from **`get_contact_party_gl_balances`** (party-mapped slice on the AR subtree).
- **Subtree TB** — trial-balance style **Dr − Cr** on the **control account id + descendants** (code 1100 family).
- **Residual / unmatched on 1100** — essentially **control TB − party-attributed slice** (sign conventions as implemented in RPC/service). A **large negative residual** means: **net movement on 1100** is **not** fully explained by **resolved party lines** — e.g. manual journals, washes, **mis-linked payments**, or PF-14 / correction chains sitting on the control without a clean contact mapping.

That matches the **operator narrative** in your screenshot: **unmapped / unmatched** credits on **1100** inflate the **residual** magnitude even when **headline** operational vs GL variance looks **clean**.

---

## 4. Practical next steps for the two example JEs

1. **JE-0065** (`journals:…`, **Cr** on a **Salar / receivable** style line): Open the journal from the lab, confirm whether it was a **manual adjustment**, **mis-coded account**, or should be **reclassified** / **relinked** to a contact. Use **Developer Integrity Lab** / **AR/AP Truth Lab** if payment chains are involved.
2. **JE-0049** (**correction_reversal**, **Dr** on **1100**): Trace the **parent economic event** / payment edit (PF-14). Ensure **effective payment id** and **party mapping** are consistent with migrations such as `party_gl_rpc_effective_payment_id` — **display** issues are separate from **posting** correctness; verify in Truth Lab before editing data.

---

## 5. Summary table — “sahi” vs “missing”

| Item | Sahi / expected? | Missing / improvement |
|------|------------------|------------------------|
| Variance 0 + unmapped &gt; 0 | Yes — different metrics | Explain in UI |
| “No display reference” for journal / correction_reversal | Yes — resolver limits | Extend `buildUiForJournal` labels |
| Receivables 0 on dashboard card vs 345k in sidebar | Often scope/definition | Rename card or add footnote; align filters |
| Large negative residual on 1100 | Signals **unmapped credits** on control | Relink / manual JE review; not “hide lines” |

---

*Last updated: 2026-04-09 — aligns with `AccountingDashboard` summary math, `accountingDisplayRefResolver`, `controlAccountBreakdownService`, and AR/AP Integrity Lab views.*
