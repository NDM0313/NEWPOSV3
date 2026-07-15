# Accounting Decisions Audit (Single Core Engine)

**Audit date:** 2026-07-15

| Decision | Date | Code | Production proof | Tests | Remaining ambiguity | Rollback | Risk |
|----------|------|------|------------------|-------|---------------------|----------|------|
| Future/native Sales Revenue = **4000** | 2026-07-10/11 | `canonicalSalesRevenueAccount` / posting fix `8adf5ff2` trail | SL-0010 / return proofs in docs | `canonicalSalesRevenueAccount.test.ts` in unit suite | None material | Revert posting resolver (not recommended) | Low if left alone |
| DIN CHINA historical import/fallback = **4100** | 2026-07-12 | Preserve import data; no rewrite | Closeout table; China Rs. 49,685,321.98 historical | Resolver tests: prefer 4000, fall back 4100 | Evidence folder for Phase 2 reclass missing | n/a | Medium if someone reclasses blindly |
| **No blanket 4100→4000 reclass** | 2026-07-12 | Explicit non-action | Closeout safety: no JE | — | Claim COMPLETE without git evidence pack | n/a | Process risk |
| Supplier Discount account **5210** | 2026-07-11/12 | Additive account | JE-0028 narrative | party discount match tests | Evidence folder missing | Void JE (not done) | Low |
| **JE-0028** Dr AP / Cr 5210 PKR 1 | 2026-07-11 | Controlled posting | Closeout + China monitoring narrative | — | Folder missing from git | reverse JE | Medium (doc-only proof) |
| Bases: `effective_party`, `official_gl`, `audit_full_history` | 2026-06+ | `_unified_ledger_basis_includes_row` | Live RPC args | basis filter tests in 339 suite | Bridal effective_party vs legacy contacts | basis switch | High for AR/AP default |
| Void/reversal handling | 2026-07-06/08 patches | unified account/TB patches | migrations applied | TB void tests | — | L1 SQL | Medium |
| Operational document handling (Party Ledger legacy) | pre-SCE | `loadEffectivePartyLedger` | still fallback | party ledger tests | Phase 8 parity | keep legacy | Medium |
| Imported historical handling | China import | preserve 4100 | closeout | — | import gap WIP **excluded** from this audit | — | Separate WIP |
| Roznamcha cash/non-cash | Phase 2.14/3B | assembler + liquidity filters | prod loaders ON | roznamcha parity tests | TT/agent wallet edge cases | L0 kill | Medium |
| Party GL sign conventions AR/AP | Phase 2b | `get_unified_contact_party_gl_balances` | live parity SSH | bridal FAIL | Walk-in old 80k | fallback legacy | **High** for AR/AP 2b complete |

## Open accounting ambiguity

Only material open item for **extension**: DIN BRIDAL Walk-in Customer old Rs. 80,000 under `effective_party` (Rs. 150 companion). Core eight-screen money reports are not blocked by this decision set.
