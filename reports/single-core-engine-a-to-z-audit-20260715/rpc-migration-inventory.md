# Database / RPC Inventory — Single Core Engine

**Audit date:** 2026-07-15
**Production RPC check:** SSH `docker exec supabase-db psql` (read-only) — all listed `get_unified_*` present

| Migration | Approx date | RPC / object | Signature (short) | Purpose | Additive? | Prod applied | Security | search_path | Used by | Fallback if missing | Parity | Remaining risk |
|-----------|-------------|--------------|-------------------|---------|-----------|--------------|----------|-------------|---------|---------------------|--------|----------------|
| `20260620140000_get_unified_party_ledger_shadow.sql` | 2026-06-20 | `get_unified_party_ledger`, `get_unified_account_ledger`, `_unified_ledger_basis_includes_row` | company, party/account, dates, basis | Core ledger lines | Yes (CREATE OR REPLACE) | YES (inferred + RPC live) | SECURITY DEFINER | public | Party/Account paths, L2, AS | legacy services | Core OK | basis semantics |
| `20260621150000_unified_ledger_phase_15_rpcs.sql` | 2026-06-21 | `get_unified_cash_bank_ledger`, `get_unified_trial_balance`, access/liquidity helpers | cash/TB | Cash/TB/Roznamcha/CF | Yes | YES | DEFINER | public | TB, Roznamcha, CF, BS/P&L | legacy | Core OK | liquidity rules |
| `20260621151000_unified_ledger_phase_15_indexes.sql` | 2026-06-21 | indexes | — | Perf | Yes | YES (assumed with 15) | n/a | n/a | all | n/a | n/a | — |
| `20260704120100_unified_ledger_roznamcha_party_tt.sql` | 2026-07-04 | liquidity / party TT helpers | — | Roznamcha TT | Yes | YES (RPC family live) | DEFINER | public | Roznamcha | legacy | OK | TT edge cases |
| `20260706150000_unified_account_ledger_reversed_voided_rows.sql` | 2026-07-06 | `get_unified_account_ledger` patch | — | Void/reverse rows | Yes | YES | DEFINER | public | Account Statement | legacy | OK | — |
| `20260707140000_unified_ledger_party_tt_agent_wallet.sql` | 2026-07-07 | agent wallet / liquidity | — | HAMID IK rules | Yes | YES | DEFINER | public | Roznamcha/CF | legacy | OK | — |
| `20260708180000_unified_trial_balance_void_reversal_parity.sql` | 2026-07-08 | `get_unified_trial_balance` | — | Void/reversal TB | Yes | YES | DEFINER | public | TB/BS/P&L | legacy | OK | — |
| `20260708190000_unified_strict_branch_null_journal_parity.sql` | 2026-07-08 | `_unified_ledger_strict_branch_includes_row` | — | Branch null parity | Yes | YES | — | public | all unified | legacy | OK | — |
| `20260712120000_get_unified_contact_party_gl_balances.sql` | 2026-07-12 (applied 2026-07-11 21:36Z) | `get_unified_contact_party_gl_balances` | company, branch, as_of, basis | AR/AP party GL | Yes | **YES** (live) | DEFINER | public | AR/AP Center | `get_contact_party_gl_balances` | **BRIDAL effective_party FAIL** | Walk-in old Δ |
| `feature_flags_table.sql` (+ ops rows) | earlier | feature_flags | — | Engine/loaders | Additive rows | YES (54 ON) | RLS/app | — | all screens | default OFF→legacy | OK | kill absent = OFF |
| Legacy | `20260333_*` family | `get_contact_party_gl_balances` | company, branch, as_of | Contacts + AR/AP fallback | Historical | YES | DEFINER | public | Contacts, AR/AP fallback | n/a | Legacy baseline | Must retain |
| Diagnostics | `20260621120000_single_core_ledger_systemwide_diagnostics.sql` | `get_single_core_ledger_systemwide_diagnostics` | — | System diagnostics | Yes | UNKNOWN (not re-checked) | — | — | admin | n/a | UNKNOWN | — |

## Distinction matrix

| Item | Code present | Migration committed | Migration applied (prod) | Runtime deployed | RPC active | Parity verified |
|------|--------------|---------------------|--------------------------|------------------|------------|-----------------|
| Core unified RPCs | YES | YES | YES | YES (`5cf65f4c`) | YES | Monitoring golden / Admin Compare historically PASS |
| AR/AP unified party balances | YES | YES (`75c12cd7`) | YES | YES | YES | COUTURE/CHINA YES; **BRIDAL effective_party NO** |
| Feature flags 8 loaders | YES | YES (ops SQL) | YES | YES | n/a | Live 54 ON |
| Contacts unified | NO | NO | NO | NO | NO | OUT OF SCOPE |

## Rollback

- L0: `unified_ledger_kill_switch` / `VITE_UNIFIED_LEDGER_ENGINE_KILLED`
- L1: `scripts/single-core-ledger/**/rollback-*.sql` (~35)
- L2: tag `r8-pre-operational-retirement-20260710` @ `ba7dadd7` + VPS rebuild

**Not assumed:** committed migration ≡ applied — each confirmed via live `pg_proc` where listed.
