# Read-only accounting tie-out — DIN CHINA Phase 2.16 drift

**Date:** 2026-07-12
**Scope:** Read-only; no production GL mutation

## JE-0028 (supplier party discount QA)

| Field | Value |
|-------|-------|
| Entry | JE-0028 |
| Posted | 2026-07-11 |
| Supplier | MR DIN MOHAMMAD |
| Dr | AP-36FE85 Rs. 1 |
| Cr | 5210 Discount Received Rs. 1 |
| Balanced | YES |
| Cash impact | None |
| 4000 / 4100 impact | None |
| TB impact | +Rs. 2 to debit/credit column totals (balanced) |

Evidence: `reports/supplier-party-discount-je-posting-qa-20260712/service-posting-closeout.json`

## MR JALIL −100,000 (primary party-ledger drift)

**Not caused by JE-0028.**

| Item | Detail |
|------|--------|
| Golden (pre-refresh) | Rs. 216,299 |
| Live closing | Rs. 116,299 |
| Delta | −Rs. 100,000 |

**Root cause:** RCV-0317 — customer receipt Rs. 100,000 for MR JALIL
- `entry_date`: 2026-05-11 (backdated)
- `created_at`: 2026-07-11 ~14:25 (posted to GL on Jul 11)
- Lines: Dr Bank DC0108 100,000 / Cr AR (MR JALIL) 100,000

**Running balance sequence (unified RPC):**
RCV-0213 → 216,300 → RCV-0317 → 116,300 → JE-0003 customer discount Rs. 1 → **116,299**

July 10 monitoring still showed 216,299 because RCV-0317 was not yet in GL.

## Trial Balance + Roznamcha drift

July 11 batch: ~23 backdated JEs posted (`created_at` 2026-07-11), including receipts and internal transfers affecting cash/bank roznamcha and TB totals.

| Metric | Pre-golden | Live (2026-07-11T20:16Z) |
|--------|------------|--------------------------|
| TB debit/credit | 358,213,589.15 | 382,219,344.15 |
| Roznamcha Cash In | 60,042,230 | 61,022,230 |
| Roznamcha Cash Out | 39,795,518 | 62,619,613 |
| Roznamcha Closing | 20,246,712 | −1,597,383 |

TB remains balanced at live totals. Admin Compare 9/9 PASS (loader parity intact).

## Unrelated companies

DIN BRIDAL and DIN COUTURE monitoring PASS — no golden change required.

## 4100 historical preservation

DIN CHINA imported 4100 (~49.6M) unchanged. No 4000/4100 reclass JE.

## Verdict

**Legitimate golden drift** from approved live GL activity (RCV-0317 + Jul 11 posting batch). JE-0028 is a minor contributor (+Rs. 2 TB only). **Not** a unified-loader regression.
