# Residual delta bridge — Phase 3B-J

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Generated:** 2026-06-29  
**Purpose:** Explain why DIN CHINA and DIN BRIDAL still differ from legacy **after** approved Q4=A and Q5=C alignment.

> Official legacy Cash Flow is unchanged. This bridge compares legacy official totals to the **finance-rule-aligned preview** only.

---

## DIN CHINA

| Field | Legacy (official) | Aligned preview | Δ |
|-------|-------------------|-----------------|---|
| Cash In | PKR 104,176,812 | PKR 35,460,880 | PKR 68,715,932 |
| Cash Out | PKR 67,042,426 | PKR 67,964,117 | PKR -921,691 |
| Closing | PKR 37,134,386 | PKR -32,503,237 | **PKR 69,637,623** |
| Row count | 323 | 236 | 87 |

### Bridge explanation

**1. Q5=C — internal transfer exclusion (expected)**

- Aligned preview excludes **169 internal transfer rows** from normal period totals.
- Legacy `getCashFlowReport` still presents transfer legs as period cash-in/cash-out (gross transfer presentation).
- Removing transfers from preview **increases** the gap vs legacy because legacy cash-in still includes transfer inflows that finance rules say should not count as period cash-in.
- Pre-alignment (3B-F) closing Δ was PKR 45,675,273; post-alignment (3B-I) is PKR 69,637,623 — **larger by design**, not a regression.

**2. Remaining unmatched cash-in/cash-out**

- Cash-in delta PKR 68,715,932 is dominated by transfer exclusion plus engine differences.
- 223 legacy-only rows (net PKR -42,779,869) vs 305 preview-only rows (net PKR -88,455,142) from 3B-F row-keyed analysis — different underlying engines (`roznamchaService` vs `get_unified_cash_bank_ledger`).

**3. Source-module buckets still needing finance context**

- `transfers` module: primary Q5 driver.
- `sales_receipts` and other modules: residual legacy-only/preview-only rows (Q6/Q7).

### Assessment

| Question | Answer |
|----------|--------|
| Delta expected from approved rules? | **YES** — Q5=C intentionally diverges from legacy transfer presentation |
| Mapper/service bug indicated? | **NO** — alignment behaves per recorded Q4/Q5/Q7 decisions |
| Aligned preview finance-basis clean? | **YES** — implements approved rules; mismatch is vs legacy basis |
| Legacy should remain official? | **YES** until explicit finance basis decision (Option B/D) |
| Finance can approve aligned as candidate basis? | **PENDING** — requires written Option A/B/C/D selection |

---

## DIN BRIDAL

| Field | Legacy (official) | Aligned preview | Δ |
|-------|-------------------|-----------------|---|
| Cash In | PKR 1,836,350 | PKR 1,003,500 | PKR 832,850 |
| Cash Out | PKR 917,780 | PKR 942,780 | PKR -25,000 |
| Closing | PKR 918,570 | PKR 60,720 | **PKR 857,850** |
| Row count | 51 | 51 | **0** |

### Bridge explanation

**1. Q4=A — opening balance summary-only (expected)**

- Aligned preview excludes **2 opening-balance rows** from normal period cash-in.
- Legacy still counts Jun 2026 opening/JE activity as period cash-in (1 legacy-only row: PKR 25,000 on 2026-06-06).
- Pre-alignment closing Δ was PKR -55,000; post-alignment is PKR 857,850 — opening exclusion materially changes aligned cash-in.

**2. Row count matches while cash-in/out differ**

- Same 51 rows on both sides, but **classification differs**: opening summary vs period cash-in, JE leg mapping.
- 48 strong row matches; 1 legacy-only; 3 preview-only (opening_balance_account / payment mapping).

**3. Remaining JE/payment mapping**

- Preview-only 3 rows net PKR 80,000 vs legacy-only 1 row PKR 25,000 — mapping of `opening_balance_account` and payment allocations drives residual without row-count change.

### Assessment

| Question | Answer |
|----------|--------|
| Delta expected from approved rules? | **YES** — Q4=A intentionally diverges from legacy opening treatment |
| Mapper/service bug indicated? | **NO** — row-count parity supports classification logic, not data loss |
| Aligned preview finance-basis clean? | **YES** |
| Legacy should remain official? | **YES** until finance basis decision |
| Finance can approve aligned as candidate basis? | **PENDING** |

---

## DIN COUTURE

| Field | Legacy | Aligned preview | Δ |
|-------|--------|-----------------|---|
| Closing | PKR 50,500 | PKR 50,500 | **PKR 0** |
| Row count | 6 | 6 | 0 |

### Bridge explanation

- No internal transfers or opening-balance reclassifications triggered in this small dataset.
- 2 exact + 4 strong matches; zero legacy-only or preview-only rows.
- **ZERO-DIFF** — strongest candidate for finance review.

### Assessment

| Question | Answer |
|----------|--------|
| Finance can review candidate? | **YES** — totals agree |
| Loader swap authorized by zero-diff alone? | **NO** — separate operator approval still required |
| Legacy should remain official? | **YES** until explicit sign-off |

---

## Cross-company conclusion

DIN CHINA and DIN BRIDAL residual deltas are **expected legacy-mismatch** after Q4=A and Q5=C — not evidence that alignment failed. The business decision is whether to:

- Keep legacy official (Option A),
- Accept aligned preview as finance basis candidate (Option B),
- Request more investigation (Option C), or
- Plan future legacy behavior change (Option D).

See [`finance-basis-decision-pack.md`](finance-basis-decision-pack.md).
