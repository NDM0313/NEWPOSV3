# Recommendation (NOT IMPLEMENTED)

## Selected option: **B. Fix AR/AP comparison baseline**

Change the production-complete parity gate (and default interpretability) so legacy `get_contact_party_gl_balances` is compared to unified **`official_gl`** (which already PASSes Bridal), **or** document that `effective_party` parity is a **diagnostic variance lens**, not a hard stop against legacy Contacts GL.

Keep `effective_party` available as the operational “economic” view (it is cleaner for the void/orphan cases found).

### Why not others

| Option | Rejected because |
|--------|------------------|
| A Fix EP rule | Would reintroduce orphan reversal Debits into EP; worsens economic AR for JE-0213 |
| C Force OG as only AR/AP UI | Loses EP clarity unless selector exists |
| D Basis selector | Strong UX follow-up; not strictly required to clear the false FAIL |
| E Bridal legacy fallback | Masks understanding; company-specific debt |
| F Data cleanup | Would mutate JEs/payments — out of scope; needs separate approval |
| G Display-only variance | Acceptable interim; does not fix gate semantics alone |
| H Further investigation | Not needed for these two exact rows |

### B — detail

| Item | Value |
|------|--------|
| Benefit | Parity gate matches same semantics as legacy Contacts RPC; Bridal PASS without mutating GL |
| Accounting meaning | Legacy/Contacts ≈ official_gl party totals; EP remains optional economic view |
| Risk | Operators may still confuse EP vs OG if UI labels unclear |
| Runtime change | **YES** (parity script + optionally AR/AP default display/compare basis) — **not done now** |
| Migration | **NO** |
| Data mutation | **NO** |
| Affected companies | All three (gate semantics); Bridal unblock primary |
| Fallback | Keep legacy RPC; keep EP RPC |
| Rollback | Revert runtime compare/default change |
| Exact approval phrase | **`APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL`** |

### Optional complement after B

Approve **`APPROVE_AR_AP_PHASE2B_BASIS_SELECTOR_UI`** later (option D) so Diagnostics can switch EP/OG/AFH explicitly without implying FAIL vs Contacts.
