# Walk-in Customer old — Rs. 80,000 Trace (`4549c5de…`)

**Company:** DIN BRIDAL
**Contact:** Walk-in Customer old (`4549c5de-0599-435a-a6ab-6e622f99be64`)

## Reconciliations

| Lens | AR |
|------|-----|
| A. Legacy / official_gl / audit_full_history | **171,500** |
| B. Unified effective_party | **91,500** |
| Difference | **80,000** |

## Exact source of the 80,000

| Field | Value |
|-------|--------|
| Journal | **JE-0213** |
| JE ID | `3e185f74-7405-4576-b278-8f9338636efe` |
| entry_date | 2026-07-04 |
| created_at | 2026-07-04 13:35:40Z |
| reference_type | **`correction_reversal`** |
| reference_id | `0a573122-…` → voided **JE-0204** (`manual_receipt`) |
| payment_id | `a8a6e09c-…` (voided_at 2026-07-04 13:35:41Z) |
| AR line | Dr **AR-CUS0001** Rs. **80,000** |
| Offset line | Cr **1061** NDM FSY Rs. 80,000 |
| is_void (JE-0213) | false |
| Paired original JE-0204 | **is_void = true** (Cr AR 80,000 when live) |

## Inclusion matrix for the void pair

| JE | Type | Amount effect on AR | Legacy / OG / AFH | effective_party |
|----|------|---------------------|-------------------|-----------------|
| JE-0204 | voided `manual_receipt` | would Cr AR 80k | **Excluded** (`is_void`) | **Excluded** (`is_void`) |
| JE-0213 | `correction_reversal` | Dr AR 80k | **Included** | **Excluded** (basis hides `correction_reversal`; also payment voided_at) |

Net void-pair effect:

- **effective_party:** neither row → as if receipt never booked → AR **91,500** (matches remaining live receipts + opening).
- **legacy / official_gl party RPC:** only reversal remains → AR inflated **+80,000** → **171,500**.

## Confirmed non-causes

Not caused by: duplicate Walk-in split alone, RCV-0075 (live separate 80k receipt still in both), branch-null alone, import China policy, or contacts mapping failure (same AR-CUS0001 / same contact_id).

## Accounting interpretation

For this voided manual receipt, **`effective_party` is economically cleaner**. Legacy/`official_gl` party-balance aggregation **overstates AR** by including an unpaired `correction_reversal` after the voided original is dropped at `is_void`.
