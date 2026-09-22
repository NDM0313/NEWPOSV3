# Financial Trace Center — Phase 1 Results (Read-Only)

**Run date/time:** 2026-06-11 18:35 UTC (VPS `psql` session)  
**Script:** `scripts/sql/diag_financial_trace_phase1.sql` (main `f75773ca`, includes enum/GROUP BY/view-column fixes)  
**Production deploy SHA (unchanged):** `483255e727f26e653949ecf303a21167cdea0aa7`  
**VPS repo HEAD at run time:** `f75773ca` (docs/SQL only — **no ERP redeploy**)  
**Database:** `supabase-db` → PostgreSQL `postgres` (DIN COUTURE VPS)  
**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**As-of date:** `2026-06-11` (`CURRENT_DATE` on server)

**Phase 1 mode:** diagnosis only — no repairs, no migrations, no Phase 3.

---

## 1. Control tie-out summary

### 1A — AR/AP integrity lab snapshot (all branches)

| Metric | Value |
|--------|------:|
| GL AR net (Dr − Cr) | **2,216,951.00** |
| GL AP net (credit convention) | **−547,191.00** |
| Unposted documents | **3** |
| Unmapped AR JEs | **14** |
| Unmapped AP JEs | **0** |
| Manual adjustment JEs | **0** |
| Suspense net | **0** |

### 1B — Control accounts (code 1100 / 2000 / 2010, void excluded)

| Code | Name | Net (Dr − Cr) | Total Dr | Total Cr | Lines |
|------|------|--------------:|---------:|---------:|------:|
| 1100 | Accounts Receivable | **−166,650.00** | 110,000.00 | 276,650.00 | **8** |
| 2000 | Accounts Payable | 0.00 | 0.00 | 0.00 | 0 |
| 2010 | Worker Payable | 0.00 | 0.00 | 0.00 | 0 |

**Observation:** Lab snapshot AR net (§1A) and raw **1100** control net (§1B) **do not match**. Lab aggregates the full AR GL subtree; 1100 header has only 8 journal lines. Party detail lives on **AR-CUS*** sub-accounts (see §8).

### 1C — Operational open documents (proxy sum)

| Metric | Value |
|--------|------:|
| Sales due sum (non-cancelled) | **288,000.00** |
| Purchases due sum | **0.00** |
| Sales with due > 0 | **3** |
| Purchases with due > 0 | **0** |

Operational due (288k) ≠ lab GL AR net (2.22M) — expected **D1 basis mix** until posting/finalization is complete and labels distinguish GL vs operational.

### 1D — Queue counts

| Queue | Count |
|-------|------:|
| Unposted docs (`v_ar_ap_unposted_documents`) | **3** |
| Distinct unmapped JEs (`v_ar_ap_unmapped_journals`) | **14** |
| Manual JE rows | **0** |

---

## 2. Inayat / REN-0002 findings

| Item | Finding |
|------|---------|
| Contact | Inayat — `AR-CUS0058` (`d73b02e8-…`) linked correctly |
| REN-0002 header | Rs **60,000** rental; **paid 60,000**; **due 0**; status **overdue** (ops label vs paid) |
| Active rental payments | **HQ-RCV-0003** Rs 50k → JE-0004 (rental, live); **HQ-RCV-0006** Rs 10k → JE-0012 (rental, live) |
| Void chain | **REN-0002-PAY** Rs 10k → JE-0011 — **voided** (`rental_payments.voided_at` set, `je_void = t`) |
| `payments` table | **0 rows** for HQ-RCV / REN-0002 refs — cash legs live on **`rental_payments` only** |
| Cash account | **1002 CASH G140** on all rental payment legs |
| Inayat AR sub-ledger net | **−30,000.00** (Cr-heavy; 3 lines) |

**Interpretation:**

- Operational rental is fully paid; AR sub-ledger still shows **−30k** net — investigate whether credits exceed debits on AR-CUS0058 (possible duplicate credit, void chain residue, or penalty/adjustment not traced in this workbook).
- **REN-0002-PAY / JE-0011 void** with **HQ-RCV-0006 / JE-0012** active matches prior dual-stream / dedupe narrative.
- Roznamcha UI check still needed: confirm HQ-RCV-0006 visible and REN-0002-PAY/JE-0011 absent.

**Taxonomy:** **D4** (dual-stream rental — `rental_payments` canonical, no `payments` mirror) + **D5** (void chain on superseded REN-0002-PAY/JE-0011).

---

## 3. Saqib / RCV-0008 findings

| Field | Value |
|-------|-------|
| AR account | **AR-CUS0060** — net **−10.00** (small residual Cr) |
| Payment RCV-0008 | Rs **17,000**; `reference_type = rental` → REN-0004; `contact_id` **NULL** |
| JE RCV-0008 | `reference_type = payment`; not void; credits AR-CUS0060 Rs 17,000 |
| Unmapped queue | **Present** — `unclassified_reference` / whitelist gap |
| Notes | "Walk-in Customer" on payment — metadata inconsistency vs Saqib AR account |

**Classification:** **Class B — metadata review only** (unchanged from `483255e7` sign-off). Financial mapping to Saqib AR-CUS0060 is correct; queue flag is heuristic.

**Taxonomy:** **D3** (metadata whitelist — JE `payment` vs payment `rental`).

**Phase 3 relink:** not recommended.

---

## 4. Walk-in false-positive findings (RCV-0017 / 18 / 19)

| Entry | Payment ref_type | JE ref_type | AR account | linked_contact |
|-------|------------------|-------------|------------|----------------|
| RCV-0017 | on_account | payment | AR-CUS0001 | Walk-in (4549c5de-…) |
| RCV-0018 | on_account | payment | AR-CUS0001 | Walk-in |
| RCV-0019 | on_account | payment | AR-CUS0001 | Walk-in |

All three: `unclassified_reference` in unmapped queue, but AR posted to **Walk-in** sub-ledger correctly via `linked_contact_id`.

**Taxonomy:** **D3** (false-positive unmapped — whitelist/heuristic gap, **no GL error**).

**UI heuristic:** `isLikelyPaymentOnAccountFalsePositive()` — risk **low**.

---

## 5. Non-final sale order findings (SL-0005 / SL-0006 / SL-0012)

| Doc | Status | Total | Paid | Sale due | Unposted amount | Sale JE |
|-----|--------|------:|-----:|---------:|----------------:|---------|
| SL-0005 | **order** | 96,000 | 25,000 | 96,000 | 96,000 | **No** |
| SL-0006 | **order** | 150,000 | 0 | 150,000 | 150,000 | **No** |
| SL-0012 | **order** | 57,000 | 15,000 | 42,000 | 42,000 | **No** |

Section **5B:** no `payment_allocations` → `payments` rows linked for these invoices in this query.

**Interpretation:** Queue label "unposted" is **technically correct** (no `reference_type=sale` JE) but **commercially expected** — orders are not final; posting gate blocks GL sale document.

**Taxonomy:** **D2** (non-final document — business workflow, not missing GL repair).

**Note on SL-0005:** `paid_amount` (25k) vs `due_amount` (96k) suggests partial payment tracking may not reduce due on order status — separate ops review, not Phase 1 repair.

---

## 6. AR 1100 vs AR-CUS sub-ledger sanity

| Slice | Net (Dr − Cr) |
|-------|--------------:|
| **1100** control account | **−166,650.00** |
| Sum of all **AR-CUS*** sub-ledgers | **2,423,601.00** |

**Gap:** **2,590,251.00** between control header and sub-ledger sum.

**Interpretation:** Chart design posts customer detail to **AR-CUS*** accounts; **1100** header is not a rolling summary of sub-ledgers in this dataset (only 8 lines on 1100). Lab snapshot AR net (2.22M) aligns with sub-ledger magnitude, not 1100 header.

**Taxonomy:** **D1** (basis / presentation — which account slice is "AR" in TB vs party statements) + flag for **D7 review** if office expects 1100 = sum(AR-CUS) — may indicate missing control rollup entries (escalate in Phase 2+, **no Phase 1 repair**).

---

## 7. Classification table (D1–D7)

| Code | Name | Rows / evidence | Phase 1 action |
|------|------|-----------------|----------------|
| **D1** | Basis mix | GL AR 2.22M vs ops due 288k; 1100 vs AR-CUS sum | Document; label surfaces in Phase 2 UI |
| **D2** | Non-final document | SL-0005, SL-0006, SL-0012 (order, no sale JE) | Explain; finalize sale = business workflow |
| **D3** | Metadata whitelist | RCV-0008 (Saqib), RCV-0017/18/19 (Walk-in) | Explain; no GL change; whitelist fix later |
| **D4** | Dual-stream rental | REN-0002: `rental_payments` only, no `payments` rows | Trace canonical ref; Roznamcha dedupe review |
| **D5** | Orphan / void chain | REN-0002-PAY + JE-0011 void; HQ-RCV-0006 active | Diagnose only; separate repair runbook if needed |
| **D6** | Branch scope | Not exercised this run (all branches) | Re-run per branch if variance found in UI |
| **D7** | True GL mismatch | Inayat AR −30k despite rental due 0; 1100 vs AR-CUS gap | **Escalate** — no Phase 1 repair; Phase 2 trace + controlled Phase 3+ if confirmed |

**Queue row summary:**

| Queue item | Count | Primary code |
|------------|------:|--------------|
| Unposted | 3 | **D2** |
| Unmapped (distinct JE) | 14 | **D3** (≥3 walk-in + ≥1 Saqib) + remaining need row-level pass |
| Manual adjustments | 0 | — |

---

## 8. Recommendation

### Diagnosis only (this phase)

- All four known cases have taxonomy codes assigned.
- **No SQL repairs**, **no apply scripts**, **no Phase 3** relink/reverse/post.
- **No deploy** until separate approval.

### No repair in Phase 1

Do **not** run: `apply_ren_0002_*`, `apply_roznamcha_*`, `fix_expense_*`, or any journal/payment mutation.

### AR/AP Phase 3

**Remains blocked** — queue rows are explained as D2/D3/D4/D5; only **D7** items (Inayat −30k AR, 1100 rollup question) need deeper trace before any controlled apply.

### What to build next (Phase 2 — UI/report, not deploy of repairs)

1. **Financial Trace Center panel** — single contact drill-down: GL statement closing = Ledger V2 official balance (validate Saqib in UI).
2. **Basis badges** on AR/AP Integrity Lab — GL vs operational vs queue heuristic.
3. **Queue row classifier UI** — surface D2/D3 labels from `arApReconciliationDiagnostics.ts` (already unit-tested).
4. **Rental dual-stream indicator** — show `rental_payments` vs `payments` canonical source (D4).
5. **TB AR drill-down** — clarify 1100 header vs AR-CUS subtree (D1), avoid comparing 1100 directly to party statements without scope note.

### Optional office follow-ups (~30 min)

- UI: Account Statements vs Ledger V2 closing balance for **Saqib** (should match post-alignment).
- Roznamcha date range: confirm HQ-RCV-0003/0006 visible for Inayat; JE-0011 absent.
- Row-level pass on remaining **~10** unmapped JEs not in sections 3–4.

---

## 9. SQL safety confirmation

| Check | Result |
|-------|--------|
| Mutating SQL in workbook | **None** — SELECT / WITH / EXISTS only |
| Read-only RPC | `ar_ap_integrity_lab_snapshot` only |
| Data changed | **No** |
| Deploy performed | **No** |
| Migrations applied | **No** |

---

## 10. Raw output reference

Full `psql` transcript captured locally during run (sections 0–END, exit code 0). Re-run:

```bash
cat scripts/sql/diag_financial_trace_phase1.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"
```

---

*Phase 1 sign-off criteria: every known case coded D1–D7; no unexplained item left without a next-step owner. Repairs and Phase 3 are explicitly out of scope.*
