# Sales Revenue 4000/4100 Reclass Phase 2 Readiness

**Date:** 2026-07-10  
**Scope:** OLD ERP / DIN Collection — read-only readiness plan only

## Status

- Phase 1 future posting standardization: **COMPLETE** (`b7fa557d`)
- Canonical account: **4100**
- 4000 fallback only (when 4100 absent)
- Historical reclass run: **no**
- Transfer JE run: **no**
- DB migration run: **no**
- Live observation (post-deploy): **PENDING** — no finalized sale/return since deploy at 2026-07-10T17:06:53Z (checked 2026-07-10; drift status `PASS_NO_DRIFT_NO_ACTIVITY`)

---

## Company review

### DIN COUTURE (`2ab65903-62a3-4bcf-bced-076b681e9b74`)

- **4000 activity:** 1 sale (SL-0001), net revenue Rs. 21,250; 1 sale JE on 4000
- **4100 activity:** Account exists in COA; **no JE activity** (net Rs. 0)
- **Risk:** **Low** — single small balance on 4000; no return history on either code
- **Recommendation:** First candidate for Phase 2 reclass after one post-deploy sale confirms 4100 posting. Transfer JE ~Rs. 21,250 from 4000 → 4100; verify TB/P&L unchanged in total.

### DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)

- **4000 activity:** 26 sale JEs, net revenue Rs. 943,750 (credits Rs. 1,080,700; debits Rs. 136,950 — includes non-return adjustments on 4000)
- **4100 activity:** **No JE activity** (net Rs. 0)
- **Risk:** **Medium** — all historical merchandise revenue on 4000 only; larger balance than COUTURE but single-code (no 4000/4100 split in P&L)
- **Recommendation:** Second in queue. Reclass moves 4000 balance to 4100 via balanced transfer JE; confirm no open sales still posting to 4000 (live observation required first). Review debit activity on 4000 before reclass.

### DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

- **4000 activity:** 3 SL sales (SL-0001…SL-0003), net Rs. 1,573,600 — post-import new engine path
- **4100 activity:** 92 DC import sales, net Rs. 49,685,321.98; 4 sale returns debited 4100 (Rs. 1,059,903)
- **Risk:** **High** — material dual-line P&L split; mixed cohorts; returns already on 4100; finance visibility required
- **Recommendation:** **Reclass only after written approval.** Do not merge until post-deploy sales confirmed on 4100 and operator signs off on Rs. 1.57M 4000 → 4100 transfer scope.

---

## Proposed Phase 2 order

1. **DIN COUTURE** — low-risk review and pilot reclass
2. **DIN BRIDAL** — medium review (single-code history on 4000)
3. **DIN CHINA** — reclass only after written approval

---

## Future reclass rules

- One balanced reclass JE per company/date window
- Dr old revenue account / Cr canonical revenue account only if needed (preserve total revenue)
- Must preserve total revenue, net profit, TB, and audit trail
- Must not rewrite old invoice rows or sale JEs
- Must not delete/deactivate **4000** until balance is zero and posting behavior verified on **4100**
- Must include rollback/reversal plan (mirror JE + evidence snapshot before apply)
- Run only on VPS with read-only pre/post TB tie-out

---

## Approval required

Do **not** run Phase 2 reclass until operator gives written approval:

```
APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2
```

Per-company scope must be named in the approval (e.g. COUTURE-only pilot).

---

## Prerequisites before any Phase 2 execution

1. At least one post-deploy finalized sale observed crediting **4100** (live observation PASS)
2. Drift check shows no new 4000 merchandise revenue while 4100 exists
3. Monitoring + unified-ledger tests PASS
4. Pre-reclass TB/P&L snapshot per company (read-only)
5. Rollback SQL template prepared (reversal JE pattern)

---

## Safety (this document)

| Item | Status |
|------|--------|
| DB migrations | not run |
| Transfer JE | not run |
| Production GL mutation | none |
| R8-R2 | not started |
