# Phase 2.9A-CB — Cash/Bank / Roznamcha Parity Remediation

**Status:** `PLANNED — not in Stage 1 scope`  
**Mode:** Future remediation track — **no feature flags**, **no Stage 1/2 SQL**, **no production loader changes** until separately approved  
**Last updated:** 2026-06-25  
**Parent:** [`SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md)  
**Evidence:** [`admin-compare-delta-investigation.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-deploy-browser-qa/admin-compare-delta-investigation.md)

---

## Why this is separate from Stage 1

| Fact | Implication |
|------|-------------|
| **Stage 1 pilot screen** | Ledger Statement V2 only (`unified_ledger_screen_ledger_v2`) |
| **Cash/Bank / Roznamcha** | Not the selected pilot screen |
| **Stage 1 behavior** | Does **not** switch any default loader — banners/resolver only |
| **Production Roznamcha** | Remains legacy `roznamchaService.getRoznamcha` |
| **Admin Compare Cash/Bank** | Shadow diagnostic only (`shadowForce: true`) |

Cash/Bank Admin Compare failures are **operational roznamcha cashbook vs unified GL cash/bank ledger semantics**, not a blocker for enabling Ledger V2 flags under Stage 1.

**Do not enable** `unified_ledger_screen_roznamcha` or any Cash/Bank pilot flag as part of Stage 1.

---

## Operator findings (2026-06-25)

| Check | Engine | Result |
|-------|--------|--------|
| Old | `roznamchaService.getRoznamcha` (+ optional `manual_receipt` GL supplement in compare) | Native roznamcha closing (e.g. −12,624,305 DIN CHINA All) |
| New | `get_unified_cash_bank_ledger` (shadow RPC, `official_gl`) | Unified closing (e.g. −8,540,887) |
| Row counts | 138 legacy vs 151 unified (typical DIN CHINA period) | Row parity achievable after economic-key compare fixes on **current preview bundle** |
| Closing delta | ~−4,083,418 (All and Bank filters) | **Informational waiver** — opening scope + roznamcha vs GL semantics |
| Stale bundle risk | Export with `basis: audit_full_history` + 138/138 missing | Wrong preview bundle (pre-`3419c8ac` economic keys); tunnel must target `:3003` |

---

## Suspected root causes (remediation backlog)

1. **Legacy Roznamcha operational rows vs unified GL rows** — roznamcha aggregates payments/expenses/transfers for cashbook UX; unified RPC emits journal lines on liquidity accounts.
2. **Expense/payment source mapping** — roznamcha `EP2026/0009` vs unified `EXP-0009`; payment entity ids vs `journalEntryLineId` (compare mappers partially normalize; production roznamcha unchanged).
3. **Row identity differences** — same receipt reposted under different JE ids; economic-key matching in Admin Compare only.
4. **Liquidity/account filter differences** — roznamcha `AccountFilter` (cash/bank/wallet/all) vs unified liquidity lens on GL accounts.
5. **Running balance / opening balance behavior** — roznamcha period opening from cashbook logic vs unified `periodOpeningBalance` from GL.
6. **Void/audit visibility rules** — compare forces `official_gl`; roznamcha has no effective_party lens; audit vs official presentation may diverge on edge rows.
7. **`manual_receipt` GL legs** — unified includes GL legs (e.g. JE-0287, JE-0309) missing from payment roznamcha path; compare-only supplement added, not production roznamcha.

---

## Remediation phases (future)

| Phase | Scope | Out of scope |
|-------|-------|--------------|
| **CB-1 Discovery** | Export parity JSON on fixed preview (`buildCommit` ≥ `312716e7`); classify missing/extra/mismatch buckets | Production loader swap |
| **CB-2 Compare hygiene** | Keep Admin Compare economic keys + waiver semantics documented | Stage 1 flags |
| **CB-3 Roznamcha source alignment** | Optional tie-out RPC or roznamcha supplement rules (additive, compare or read path) | Migrations without approval |
| **CB-4 Pilot decision** | Separate ops ticket if roznamcha screen ever joins pilot matrix | Stage 1 Ledger V2 |

---

## Acceptance criteria (when CB track completes)

- [ ] Admin Compare Cash/Bank row parity PASS on DIN CHINA reference period **or** signed ops waiver with documented closing delta
- [ ] Roznamcha production screen behavior documented vs unified RPC
- [ ] No Stage 1/2 flag enablement required for CB closure
- [ ] `npm run test:unified-ledger` includes CB regression fixtures

---

## References

- Compare mappers: `src/app/lib/roznamchaCashBankCompareMappers.ts`
- Compare service: `src/app/services/unifiedLedgerCashBankCompareService.ts`
- Preview: `erp-frontend-preview` VPS `:3003`, tunnel `localhost:3002 → 127.0.0.1:3003`
- DIN CHINA company `30bd8592-3384-4f34-899a-f3907e336485`, branch BL0002 `92f4184e-ee9b-4b6c-8e76-10ee1d166f55`
