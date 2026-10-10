# JE-0028 Live Verification (RECONSTRUCTED FROM LIVE READ-ONLY DATA)

**Date:** 2026-07-15
**Original evidence folder:** `reports/supplier-party-discount-je-posting-qa-20260712/` — **ORIGINAL EVIDENCE MISSING**
**This pack is not the original execution evidence.**

| Field | Live value | Matches claim? |
|-------|------------|----------------|
| Company | DIN CHINA (`30bd8592-…`) | YES |
| Entry | **JE-0028** | YES |
| Journal entry ID | `a00ea279-6c4e-425e-9492-a96bf6b7d552` | — |
| Entry date | 2026-07-11 | YES |
| created_at | 2026-07-11 19:54:44.936Z | — |
| reference_type | `party_discount` | YES |
| reference_id | `36fe85d7-95cf-49ad-8922-cabe5f3596cc` (supplier) | YES |
| action_fingerprint | `party_discount:30bd8592-…:supplier:36fe85d7-…:2026-07-11:1` | YES |
| Description | Controlled supplier party discount QA — PKR 1 — MR DIN MOHAMMAD | YES |
| Supplier | MR DIN MOHAMMAD (AP-36FE85) | YES |
| Debit | AP-36FE85 Payable — MR DIN MOHAMMAD **Rs. 1.00** | YES |
| Credit | **5210** Discount Received **Rs. 1.00** | YES |
| total_debit / total_credit | 1.00 / 1.00 | Balanced YES |
| is_void | false | YES |
| is_posted | true | YES |
| branch_id | null | — |
| Cash impact | None (AP vs expense/discount; no cash/bank line) | YES |
| 4000/4100 impact | None | YES |

## Account 5210

| Field | Value |
|-------|--------|
| Exists | YES |
| ID | `aced7568-262b-4df4-877f-b3bd566a875a` |
| Name | Discount Received |
| is_active | true |
| created_at | 2026-07-11 19:54:44.551Z (same second as JE) |

**5210 created specifically for this QA:** highly likely (created_at ≈ JE created_at).

## Final classification

**VERIFIED** against production — **RECONSTRUCTED FROM LIVE READ-ONLY DATA**.
Closeout COMPLETE claim for Supplier PKR1 is **supported by DB**; original folder remains **ORIGINAL EVIDENCE MISSING**.
