# Single Core Ledger — Phase 1.6.1 Branch Manual Review

**Run at:** 2026-06-23T15:48:29.561Z
**Clone DB:** ledger_stage_20260623
**Row count:** 6

## Summary by company

| Company | Rows | safe_recommendation | finance_required | exception_candidate |
|---------|-----:|--------------------:|-----------------:|--------------------:|
| DIN BRIDAL | 2 | 0 | 2 | 0 |
| DIN CHINA | 4 | 0 | 2 | 2 |

## Row detail

### DIN BRIDAL — JE-0204 (manual_receipt)

- **journal_entry_id:** `0a573122-9cd1-4192-a61c-b948fd14abe8`
- **date:** Sat Jun 06 2026 00:00:00 GMT+0000 (Coordinated Universal Time)
- **description:** Customer receipt from Walk-in Customer old. (N31 Rently RB "
- **amount:** 80000
- **final_status:** finance_required
- **confidence:** low
- **evidence:**
  - No deterministic branch from payment or account

### DIN BRIDAL — JE-0170 (manual_receipt)

- **journal_entry_id:** `21401d60-1e89-422d-bcdb-59310556d600`
- **date:** Mon Jun 01 2026 00:00:00 GMT+0000 (Coordinated Universal Time)
- **description:** Customer receipt from Walk-in Customer. N32
- **amount:** 40000
- **final_status:** finance_required
- **confidence:** low
- **evidence:**
  - No deterministic branch from payment or account

### DIN CHINA — JE-0309 (manual_receipt)

- **journal_entry_id:** `1dd932ff-8798-46b4-8e47-b55832611515`
- **date:** Wed Apr 29 2026 00:00:00 GMT+0000 (Coordinated Universal Time)
- **description:** Customer receipt from MR YOUNS CHARSADA. [Edited 23/06/2026, 6:39 pm: Rs 58,500 → Rs 58,000]
- **amount:** 58000
- **final_status:** finance_required
- **confidence:** low
- **evidence:**
  - No deterministic branch from payment or account

### DIN CHINA — JE-0287 (manual_receipt)

- **journal_entry_id:** `653e66d2-6c38-41fc-b396-306488ae52e7`
- **date:** Fri Apr 24 2026 00:00:00 GMT+0000 (Coordinated Universal Time)
- **description:** Customer receipt from DIN COUTURE.
- **amount:** 13000000
- **final_status:** finance_required
- **confidence:** low
- **evidence:**
  - No deterministic branch from payment or account

### DIN CHINA — FT-000287 (transfer)

- **journal_entry_id:** `a1e0faf5-30ca-499b-9ba2-cc1bd8e25a67`
- **date:** Tue Sep 30 2025 00:00:00 GMT+0000 (Coordinated Universal Time)
- **description:** Owner Capital → MCB last Year Finical
- **amount:** 1500000
- **final_status:** exception_candidate
- **confidence:** low
- **evidence:**
  - Both liquidity accounts have NULL branch_id (company-wide COA)
  - Description: Owner Capital → MCB last Year Finical
  - Company-level bank transfer may intentionally have NULL JE branch_id

### DIN CHINA — FT-000309 (transfer)

- **journal_entry_id:** `a1cc92d7-443f-465d-9473-9d6b526fdb99`
- **date:** Tue Feb 11 2025 00:00:00 GMT+0000 (Coordinated Universal Time)
- **description:** Transfer MCB → WALI DIN T/T — WALI TT
- **amount:** 500000
- **final_status:** exception_candidate
- **confidence:** low
- **evidence:**
  - Both liquidity accounts have NULL branch_id (company-wide COA)
  - Description: Transfer MCB → WALI DIN T/T — WALI TT
  - Company-level bank transfer may intentionally have NULL JE branch_id

---

## Operator decisions (clone apply @ 2026-06-23T15:50:06Z)

All 6 rows approved via `clone-operator-branch-decisions.example.json`:

| entry_no | company | approved_branch | operator_note |
|----------|---------|-----------------|---------------|
| JE-0204 | DIN BRIDAL | HQ — Main Branch | Walk-in manual_receipt → Main Branch |
| JE-0170 | DIN BRIDAL | HQ — Main Branch | Walk-in manual_receipt → Main Branch |
| JE-0309 | DIN CHINA | BL0002 — DIN CHINA | Sole active branch |
| JE-0287 | DIN CHINA | BL0002 — DIN CHINA | Sole active branch |
| FT-000287 | DIN CHINA | BL0002 — DIN CHINA | Finance override (company bank transfer) |
| FT-000309 | DIN CHINA | BL0002 — DIN CHINA | Finance override (company bank transfer) |

**Apply result:** 6/6 updated on clone. Audit: `reports/single-core-ledger/branch-manual-apply-audit-2026-06-23T15-50-06-177Z.json`

## Gate A (post Phase 1.6.1)

| Check | Result |
|-------|--------|
| branch_attribution_risk | **0** |
| strict diagnostics | **3/3 PASS** |
| pilot tie-out | **PASS** 9/9 |
| production postgres | **Untouched** |
