# AR/AP Phase 2.1 — Saqib / RCV-0008 Diagnostic Report

**Date:** 2026-06-11  
**Environment:** Production VPS (`dincouture-vps`, `erp.dincouture.pk`)  
**Method:** Read-only SQL + code-path review. **No repairs applied.**  
**Script:** [`scripts/sql/diag_ar_ap_saqib_rcv0008.sql`](../../scripts/sql/diag_ar_ap_saqib_rcv0008.sql)

---

## Executive summary

| Item | Result |
|------|--------|
| **Classification** | **B — Mapped financially — source metadata needs review** |
| **Financial repair required** | **No** |
| **Phase 3 apply/relink/reverse** | **Not recommended** for this row |
| **Hide as false-positive** | **No** — moved to queue **2c (metadata review)** in Phase 2.1 UI only |

RCV-0008 is a **Rs 17,000 rental remaining payment** for **REN-0004 (Saqib)**. The AR sub-ledger line posts correctly to **AR-CUS0060 (Saqib)** and the account **closes at zero** after penalty receipts. The row appears in the AR/AP unmapped queue because the **journal entry header** uses `reference_type = payment`, which is **not on the AR whitelist**, while the **payments** row correctly uses `reference_type = rental`. Additional metadata gaps (`payment.contact_id` null, JE description “Walk-in Customer”) do not affect ledger totals.

**No** `developer_repair_audit`, `journal_party_contact_mapping`, or `correction_reversal` rows were found for this chain.

---

## Classification rationale

### Why not A (true false-positive)

Category A requires payment contact = Saqib. Production shows `payments.contact_id` **NULL** and JE description **“Walk-in Customer”**. The financial mapping is correct via AR sub-ledger `linked_contact_id`, but source metadata is incomplete — not a clean false-positive like RCV-0017/18/19 (`on_account` + matching payment contact).

### Why B (metadata / source-link only)

- AR-CUS0060 `linked_contact_id` = Saqib ✓  
- Rental REN-0004 `customer_id` = Saqib ✓  
- JE lines balanced (Dr 17,000 NDM EASY / Cr 17,000 AR-CUS0060) ✓  
- AR-CUS0060 net Dr−Cr = **0** ✓  
- Payment `reference_type = rental`, `reference_id` = REN-0004 UUID ✓  
- JE `reference_type = payment` → `unclassified_reference` in `v_ar_ap_unmapped_journals` ✗ (whitelist gap)

### Why not C (prior forced repair)

- `developer_repair_audit`: **0 rows**  
- `journal_party_contact_mapping`: **0 rows**  
- `correction_reversal` JEs: **0 rows**  
- `ar_ap_reconciliation_review_items`: **0 rows**

The rental **dual-stream** pattern (`rental_payments` + `payments` sharing one JE) is documented for REN-0004 advance (HQ-RCV-0001 / JE-0010) in [`15_ROZNAMCHA_DUPLICATE_TRACE_REVIEW.md`](coa-developer-center/15_ROZNAMCHA_DUPLICATE_TRACE_REVIEW.md). That is a **reporting dedupe** pattern, not evidence of a forced GL repair balancing this receipt.

Voided test receipt **RCV-0015** (Rs 10, Saqib) does not affect closing balance.

### Why not D (real GL mismatch)

- No wrong-party AR posting  
- No broken balance on AR-CUS0060  
- Rental `paid_amount` (23,500) = charges (20,000) + penalty (3,500) ✓

---

## Evidence tables

### 1. Contact / account mapping

| Field | Value |
|-------|-------|
| Contact id | `e63ee52a-eca0-43c5-b7cc-bba5e278e646` |
| Contact name | Saqib |
| AR account id | `9720eeef-acb2-474f-9398-8cc0de3b2081` |
| AR account code | AR-CUS0060 |
| `accounts.linked_contact_id` | Saqib (matches) |

### 2. Rental source (REN-0004)

| Field | Value |
|-------|-------|
| Rental id | `14d4c6fd-c55f-4753-96df-7d16d0319542` |
| booking_no | REN-0004 |
| customer_id | Saqib |
| status | returned |
| rental_charges / total_amount | 20,000 |
| paid_amount | 23,500 |
| due_amount | 0 |
| damage_charges | 3,500 |
| penalty_paid | true |
| pickup / return | 2026-06-03 / 2026-06-07 (returned 2026-06-08) |

### 3. Payment row (RCV-0008)

| Field | Value |
|-------|-------|
| Payment id | `315c21c2-ed7b-4a3f-97d6-4ca4f3c34f44` |
| reference_number | RCV-0008 |
| amount | 17,000 |
| payment_date | 2026-06-03 |
| reference_type | **rental** |
| reference_id | REN-0004 UUID |
| contact_id | **NULL** |
| notes | Receipt RCV-0008 (Walk-in Customer) |
| cash account | 1021 NDM EASY |

### 4. rental_payments (REN-0004)

| Ref | Amount | Type | JE link |
|-----|--------|------|---------|
| HQ-RCV-0001 | 3,000 | advance | JE-0010 (`99d5843e-…`) |
| HQ-RCV-0004 | 17,000 | remaining | RCV-0008 JE (`56080f6a-…`) |
| Damage/penalty | 3,500 | penalty | JE-0198 (`c85dba84-…`) |

### 5. Journal headers

| entry_no | date | reference_type | description | void |
|----------|------|----------------|-------------|------|
| JE-0009 | 2026-05-31 | rental | Rental charges — Saqib | no |
| JE-0010 | 2026-05-31 | rental | Rental booking advance — REN-0004 (Saqib) | no |
| **RCV-0008** | 2026-06-03 | **payment** | Receipt RCV-0008 (Walk-in Customer) | no |
| JE-0197 | 2026-06-08 | rental | Rental penalty / damage — Saqib | no |
| JE-0198 | 2026-06-08 | rental | Rental penalty receipt — Saqib | no |
| RCV-0015 | 2026-06-09 | payment | Receipt RCV-0015 (Saqib) - Test | **yes** |

### 6. JE lines — AR-CUS0060 chain

| entry_no | Dr | Cr | Notes |
|----------|----|----|-------|
| JE-0009 | 20,000 | 0 | Rental charges |
| JE-0010 | 0 | 3,000 | Advance |
| RCV-0008 | 0 | 17,000 | Remaining payment |
| JE-0197 | 3,500 | 0 | Penalty/damage |
| JE-0198 | 0 | 3,500 | Penalty receipt |
| **Net (non-void)** | **23,500** | **23,500** | **Closing 0** |

### 7. Payment vs JE reference mismatch

| Source | reference_type | reference_id |
|--------|----------------|--------------|
| payments RCV-0008 | rental | REN-0004 UUID |
| journal_entries RCV-0008 | payment | payment UUID `315c21c2-…` |

Queue reason (`v_ar_ap_unmapped_journals`): `unclassified_reference` — *Reference type is not on the AR/AP whitelist; subledger mapping uncertain.*

Whitelist includes `rental` but **not** `payment` ([`migrations/20260330_ar_ap_repair_workflows.sql`](../../migrations/20260330_ar_ap_repair_workflows.sql)).

### 8. Previous repair / manual history

| Table | Rows |
|-------|------|
| journal_party_contact_mapping | 0 |
| developer_repair_audit | 0 |
| correction_reversal | 0 |
| ar_ap_reconciliation_review_items | 0 |

Manual/test: voided RCV-0015 (Rs 10 test on Saqib AR).

### 9. Ledger comparison

| View | Dr | Cr | Net |
|------|----|----|-----|
| Account Ledger AR-CUS0060 | 23,500 | 23,500 | **0** |
| Rental REN-0004 paid | — | — | 23,500 (= 20k + 3.5k penalty) |
| AR/AP queue | 1 line | Cr 17,000 | metadata flag only |

---

## Recommendation

1. **No repair** — do not relink, reverse, repost, or apply Phase 3 actions on RCV-0008.  
2. **Metadata review only** — optional future improvement: align JE header `reference_type` to `rental` (or extend whitelist handling for payment JEs whose `payment_id` points to rental payments). Requires separate approved change; not Phase 2.1.  
3. **UI (Phase 2.1):** Row classified in queue **2c — Mapped financially — metadata review** with trace text; **not** in default repair queue 2.  
4. **Do not** silently hide as category-A false-positive.

---

## Phase 2.1 UI changes (safe labeling only)

| Change | File |
|--------|------|
| Heuristic `isLikelyRentalPaymentMetadataReview` | `src/app/lib/arApReconciliationDiagnostics.ts` |
| Queue **2c** + badge | `ArApReconciliationCenterPage.tsx`, `ArApRepairBadges.tsx` |
| Row trace classification text | `RowTracePanel.tsx` |
| Test case RCV-0008 | `arApReconciliationDiagnostics.test.ts` |
| Queue **1a** helper text (SL-0005/06/12) | `ArApReconciliationCenterPage.tsx` |

**No** migrations, apply/post/relink/reverse, or GL/payment/journal mutations.

---

## Confirmation

- **GL / payments / journals / contacts / mappings:** unchanged (read-only diagnosis only)  
- **Phase 3:** not started  
- **Production SQL run:** 2026-06-11 on VPS via `diag_ar_ap_saqib_rcv0008.sql` (+ validated supplement queries)
