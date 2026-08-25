# Flag state verification — BS/P&L post-swap

**Generated:** 2026-07-01  
**Result:** PASS

## BS/P&L keys (all `enabled=true` for three companies)

| Key | DIN CHINA | DIN BRIDAL | DIN COUTURE |
|-----|-----------|------------|-------------|
| `unified_ledger_loader_balance_sheet` | yes | yes | yes |
| `unified_ledger_loader_profit_loss` | yes | yes | yes |
| `unified_ledger_screen_balance_sheet` | yes | yes | yes |
| `unified_ledger_screen_profit_loss` | yes | yes | yes |

## Scope checks

- **Total `unified_ledger%` rows:** 54 (18 keys × 3 companies only)
- **Other companies:** 0 unified loader flags ON
- **Cash Flow flags:** unchanged (still enabled for pilot trio)
- **Kill switch:** not changed; monitoring shows `killSwitchActive: false` on captures
- **Unexpected flags:** none

Query: `scripts/single-core-ledger/query-unified-ledger-flags-readonly.sql` (read-only)
