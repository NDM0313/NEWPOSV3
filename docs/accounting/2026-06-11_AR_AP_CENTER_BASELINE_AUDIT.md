# AR/AP Reconciliation Center — Phase 1 Baseline Audit

**Date:** 2026-06-11  
**Scope:** Read-only production diagnosis (DIN Collection ERP). No UI changes, no GL/posting/relink/reverse applied.  
**Script:** [`scripts/sql/diag_ar_ap_center_baseline_audit.sql`](../../scripts/sql/diag_ar_ap_center_baseline_audit.sql)  
**Company:** `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` (inferred from sample sales)

---

## 1. Queue counts (as of 2026-06-11, all branches)

From `ar_ap_integrity_lab_snapshot` + view counts:

| Metric | Count / value |
|--------|----------------|
| Unposted documents | **3** |
| Unmapped AR journal entries (distinct) | **14** |
| Unmapped AP supplier JEs | **0** |
| Unmapped worker payable JEs | **0** |
| Manual / suspense JEs | **0** |
| Suspense (1195) net balance | **0** |
| GL AR net (Dr − Cr, as-of) | **2,216,951.00** |
| GL AP net credit (as-of) | **547,191.00** |
| Operational vs GL variance | Shown on UI summary cards (unchanged this audit) |
| `ar_ap_reconciliation_review_items` rows | **1** (not tied to sample refs) |
| Unmapped line rows (all AR lines in view) | **14** |

**Unposted queue open amount (due-based):** Rs **288,000**  
(SL-0005 96,000 + SL-0006 150,000 + SL-0012 42,000)

**Sample unmapped AR credits (RCV-0017/18/19 only):** Rs **46,000**  
(20,000 + 6,000 + 20,000)

---

## 2. Sample row analysis — unposted sales

### SL-0005

| Field | Value |
|-------|--------|
| Sale ID | `b6c40f48-b8f8-4b62-9644-2ddfd29608ff` |
| Status | **`order`** (not `final`) |
| Customer | Patras |
| Total | 96,000 |
| Paid | 25,000 |
| Due (queue amount) | 96,000 |
| Invoice date | 2026-06-01 |
| Branch | Stitch and Style |
| Sale JE exists? | **No** |
| In unposted view? | **Yes** — reason: no non-void `reference_type=sale` JE |

**Why in queue:** View flags any non-cancelled sale with total > 0 and **no sale document JE**, regardless of commercial status.

**Posting via current UI:** **Would fail validation** — `canPostAccountingForSaleStatus('order')` is false; `validateUnpostedDocumentForPosting` returns status issue. Row is a **data-quality / workflow** item (order with partial payment, no revenue JE), not a simple “missing final posting”.

**Suggested fix (Phase 2+):** Finalize sale first, then validate posting wizard; or mark **manual_reviewed** if intentionally non-posted order.

**Risk:** **Medium** if user clicks “Post document to GL” without reading validation errors; **Low** if validation blocks (current code blocks).

---

### SL-0006

| Field | Value |
|-------|--------|
| Sale ID | `3ff0b1ef-b975-4898-9b3a-9a6b9d721cc0` |
| Status | **`order`** |
| Customer | Patras |
| Total | 150,000 |
| Paid | 0 |
| Due | 150,000 |
| Invoice date | 2026-05-31 |
| Sale JE | **None** |
| In unposted view? | **Yes** |

Same pattern as SL-0005: **order-stage sale** in missing-posting queue. Post action **blocked by status gate** unless sale is finalized.

**Risk:** Medium (misleading queue label — looks like “missing JE” but root cause is **non-final status**).

---

### SL-0012

| Field | Value |
|-------|--------|
| Sale ID | `4a080eeb-4866-4c90-8265-bceec62d6727` |
| Status | **`order`** |
| Customer | MAHVISH IQBAL |
| Total | 57,000 |
| Paid | 15,000 |
| Due (queue amount) | 42,000 |
| Invoice date | 2026-06-01 |
| Sale JE | **None** |
| In unposted view? | **Yes** |

Partial payment on **order** status; no sale JE. Validation would reject posting until **final**.

**Risk:** Medium; partial payments on non-final sales may also appear in operational ledgers — trace panel should show payment JEs separately (not audited in this script).

---

## 3. Sample row analysis — unmapped AR (RCV payments)

All three share the same pattern:

| Ref | JE | Amount | Payment `reference_type` | JE `reference_type` | AR account | Payment contact |
|-----|-----|--------|--------------------------|---------------------|------------|-----------------|
| RCV-0017 | RCV-0017 | 20,000 | **on_account** | **payment** | AR-CUS0001 Walk-in | Walk-in Customer old |
| RCV-0018 | RCV-0018 | 6,000 | **on_account** | **payment** | AR-CUS0001 Walk-in | Walk-in Customer old |
| RCV-0019 | RCV-0019 | 20,000 | **on_account** | **payment** | AR-CUS0001 Walk-in | Walk-in Customer old |

**Cash/bank legs:** RCV-0017/18 → CASH G140 (1002); RCV-0019 → NDM EASY (1021).

**Why in unmapped queue:** Heuristic in `v_ar_ap_unmapped_journals` treats JE `reference_type = payment` as **`unclassified_reference`** (whitelist includes `on_account`, `manual_receipt`, etc., but **not** bare `payment`). Lines lack `party_contact_id` on `journal_entry_lines` (future column).

**Important:** GL **did post** to the correct **Walk-in** sub-ledger (`AR-CUS0001`, `linked_contact_id` = payment contact). This is likely a **false-positive queue row** for party mapping, not a missing posting.

**Business suspicion:** JE descriptions reference **Nabeel / Noman** balances while contact is Walk-in — operational relink to a named customer may be desired, but that is a **business decision**, not an automatic GL error.

**`journal_party_contact_mapping`:** No rows for these JEs (relink never applied).

**Risk if “Relink contact” used today:** **Medium** — saves audit mapping only; **does not change JE lines** (dialog warns). User may think AR is fixed when GL unchanged.

**Risk if “Open journal wizard” → Execute void:** **High** — voids live cash receipt JEs (Rs 46,000) without dry-run or typed confirm.

---

## 4. Current action buttons — classification

Source: [`ArApReconciliationCenterPage.tsx`](../../src/app/components/accounting/ArApReconciliationCenterPage.tsx), [`ArApRepairDialogs.tsx`](../../src/app/components/accounting/ArApRepairDialogs.tsx), [`arApRepairWorkflowService.ts`](../../src/app/services/arApRepairWorkflowService.ts).

### Queue 1 — Missing / unposted documents

| Action | Type | Mutates data? | Notes |
|--------|------|---------------|-------|
| Open source document | **Partial** | No | Sale: opens sale by ID. Purchase: navigates to list only. |
| Validate & create posting… | **Real apply** | **Yes** — creates sale/purchase JE via `documentPostingEngine` | No proposed-JE preview; no `CREATE POSTING` phrase; gated by `canPostAccounting` |
| Quick: mark reviewed | **Status-only** | Review table only | `upsert_ar_ap_reconciliation_item` |
| Fix status dropdown | **Status-only** | Review table only | |

### Queue 2 — Customer/supplier unmapped

| Action | Type | Mutates data? | Notes |
|--------|------|---------------|-------|
| Open journal wizard | **Real apply** (step 2) | **Yes** — void or rebuild JE | Can execute immediately; no `ready_to_reverse_repost` gate |
| Relink contact… | **Partial** | **Audit only** — `journal_party_contact_mapping` insert | GL lines unchanged |
| Mark ready to reverse/repost | **Status-only** | Review table | Does not prevent wizard execute |
| Mark ready to relink | **Status-only** | Review table | |
| Mark resolved | **Status-only** | Review table | No reason required; row can stay in SQL view |
| Fix status dropdown | **Status-only** | |

### Queue 3 — Worker payable unmapped

| Action | Type | Mutates data? | Notes |
|--------|------|---------------|-------|
| Open journal wizard | **Real apply** | **Yes** | Same as queue 2 |
| Relink worker contact… | **Partial** | Audit mapping only | |
| Mark resolved | **Status-only** | |
| Fix status dropdown | **Status-only** | |

### Queue 4 — Manual / suspense

| Action | Type | Mutates data? | Notes |
|--------|------|---------------|-------|
| Wizard | **Real apply** | **Yes** | Opens same journal wizard |
| Fix status dropdown | **Status-only** | |

### Header actions

| Action | Type | Mutates data? |
|--------|------|---------------|
| Ensure suspense (1195) | **Real apply** | Creates COA account if missing (idempotent RPC) |
| Open Accounting | Navigation | No |
| Developer Integrity Lab | Navigation | No |
| Refresh | Read | No |
| Hide resolved | UI filter | No |

---

## 5. Unsafe or misleading behaviors (Phase 1 findings)

| Issue | Severity | Detail |
|-------|----------|--------|
| Post without dry-run / confirm phrase | **High** | Unposted dialog posts on single button click |
| Journal wizard void/rebuild without queue gate | **High** | RCV rows can be voided from wizard immediately |
| Mark resolved without verification | **Medium** | Hides row in UI but SQL view unchanged |
| Unposted view includes **order** sales | **Medium** | Looks like missing JE; post will fail — confusing |
| Unmapped heuristic flags **payment** JEs | **Medium** | RCV rows appear unmapped though Walk-in sub-ledger is correct |
| Relink implies GL fix | **Medium** | Only audit table updated |
| No page-level role gate | **Medium** | Any user with nav access sees center; only `canPostAccounting` blocks post |
| Mark resolved / status changes | **Low** | No audit trail beyond `review_items` (no before/after JSON) |

---

## 6. What already works (keep in Phase 2)

- Queue views and integrity snapshot RPC are **stable** and match production counts.
- `validateUnpostedDocumentForPosting` **blocks** non-final sales (protects SL-0005/6/12 from accidental JE if validation runs).
- Worker vs supplier AP split (`ap_sub_bucket`) is **correct** (0 worker/supplier unmapped AP in snapshot).
- Relink dialog **discloses** mapping-only behavior.
- Review item persistence via `upsert_ar_ap_reconciliation_item`.

---

## 7. Recommended Phase 2 UI changes (no implementation in Phase 1)

1. **Source document modal** (read-only): status, GL posted?, linked JE, attachments — before any action.
2. **Posting wizard:** validation issues → **proposed JE lines** → dry-run → typed **`CREATE POSTING`** → apply.
3. **Unposted queue filter:** separate “**non-final document**” vs “**final, missing JE**” using sale status.
4. **Relink wizard:** before/after contact + account; dry-run; **`RELINK CONTACT`**; clarify GL unchanged until future RPC.
5. **Journal wizard:** disable **Execute** unless status is `ready_to_reverse_repost` or user is Developer/Super Admin; add dry-run + confirm phrase.
6. **Mark resolved:** require reason; auto-allow only if row absent from view after re-fetch.
7. **Row trace panel:** show payment + JE lines + heuristic reason (e.g. `reference_type=payment` false positive).
8. **Summary cards:** clickable filters + amounts (missing posting Rs 288k, unmapped AR credits, etc.).
9. **Permissions:** route guard — block salesman; read-only for Accounting Auditor.
10. **Financial Trace link:** open RCV / SL refs in drill-down parity tab (separate plan).

**Optional view/SQL improvement (Phase 3+ migration):** Add `payment` to AR whitelist when `payments.reference_type = on_account` and AR line uses linked sub-ledger — reduces false positives like RCV-0017/18/19.

---

## 8. Phase 1 deliverables checklist

| Item | Done |
|------|------|
| Baseline SQL script (read-only) | Yes |
| VPS run | Yes |
| Queue counts | Section 1 |
| SL-0005 / SL-0012 / SL-0006 analysis | Section 2 |
| RCV-0017 / RCV-0018 / RCV-0019 analysis | Section 3 |
| Action button classification | Section 4 |
| Unsafe behavior list | Section 5 |
| Phase 2 recommendations | Section 7 |
| GL / payment / journal mutation | **None** |
| UI code changes | **None** |
| Migrations | **None** (diagnostic SQL only) |

---

## 9. Build result

Phase 1 added:

- `scripts/sql/diag_ar_ap_center_baseline_audit.sql` (read-only)
- This report

No application TypeScript/React changes. **`npm run build` not required** for Phase 1 sign-off. Trial Balance, Account Statements, Ledger V2, and GL logic **unchanged**.

---

## 10. Sign-off for Phase 2

Proceed to Phase 2 only after review of:

- Whether **order-stage** sales should appear in unposted queue or a separate “non-postable” bucket.
- Whether RCV **payment** reference type should be excluded from unmapped heuristic.
- Confirm phrase + audit table design for apply actions.
