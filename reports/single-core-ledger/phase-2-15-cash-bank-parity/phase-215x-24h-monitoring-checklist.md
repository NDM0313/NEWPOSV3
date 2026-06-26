# Phase 2.15X — 24h monitoring checklist (DIN CHINA)

**Company:** `30bd8592-3384-4f34-899a-f3907e336485`  
**Start after closeout:** 2026-06-26

## Daily checks

- [ ] **Roznamcha totals** (wide range, All Branches): Cash In 136,158,012 / Cash Out 67,042,426 / Closing 69,115,586
- [ ] **Trial Balance** debit = credit = PKR 407,957,271.02 (All Branches)
- [ ] **MR JALIL closing** PKR 216,300 on Ledger V2, Account Statement, Party Ledger
- [ ] **Main loaders** all show `unified` on LV2 / AS / TB / PL / Roznamcha
- [ ] **Roznamcha preview** compare = `legacy_shadow` when loader ON

## Flag hygiene

- [ ] No loader flags ON for companies other than DIN CHINA
- [ ] No unsupported `unified_ledger_loader_cash_bank` (or similar) flag enabled
- [ ] Expected 12 DIN CHINA `unified_ledger_*` flags remain ON (pilot, engine, 5 screens, 5 loaders)

## Operational

- [ ] Browser console: no spike in RPC errors on accounting screens
- [ ] User complaints: none re roznamcha totals / missing payments / wrong closing
- [ ] Export/print spot-check: Roznamcha PDF/Excel totals match on-screen summary (weekly if no daily export use)

## SQL quick checks (read-only)

```bash
# Flags
ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres" < scripts/single-core-ledger/phase-215x-final-flags.sql

# Trial Balance
ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres" < scripts/single-core-ledger/phase-215-cross-screen-regression.sql
```

## Escalation

Rollback Roznamcha only if golden totals diverge or user-facing regression confirmed. Use `phase-214-rollback-roznamcha-loader.sql` (L1) first.

Do **not** rollback LV2/AS/TB/PL unless those screens regress independently.
