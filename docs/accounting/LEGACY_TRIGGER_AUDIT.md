# Legacy trigger audit — accounting vs app engine

## User-requested triggers

| Trigger | Purpose | Recommendation |
|--------|---------|------------------|
| `trigger_auto_post_sale_to_accounting` | DB inserts `journal_entries` on sale → `final` | **DROP** — duplicates `saleAccountingService.createSaleJournalEntry` |
| `trigger_auto_post_purchase_to_accounting` | DB inserts JEs on purchase → `final` | **DROP** — duplicates `PurchaseContext` / future purchase service JE |
| `trigger_update_stock_on_sale` | Legacy `stock_movements.type` insert | **DROP** (see `20260312_fix_stock_movements_legacy_type_column.sql`) |
| `trigger_update_stock_on_purchase` | Legacy `stock_movements.type` insert | **DROP** (same migration) |
| `trigger_update_contact_balance_on_sale` | Mutates contact balances from sales | **DROP** if customer/supplier subledger is app-driven only |
| `trigger_update_contact_balance_on_purchase` | Mutates contact balances from purchases | **DROP** (same) |
| `trigger_calculate_sale_totals` | Recomputes sale totals from lines | **KEEP** — not accounting posting |
| `trigger_calculate_purchase_totals` | Recomputes purchase totals from lines | **KEEP** |

## Verify active triggers (run on Supabase SQL)

```sql
SELECT tg.tgname AS trigger_name,
       c.relname AS table_name,
       pg_get_triggerdef(tg.oid) AS definition
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT tg.tgisinternal
  AND tg.tgname IN (
    'trigger_auto_post_sale_to_accounting',
    'trigger_auto_post_purchase_to_accounting',
    'trigger_update_stock_on_sale',
    'trigger_update_stock_on_purchase',
    'trigger_update_contact_balance_on_sale',
    'trigger_update_contact_balance_on_purchase',
    'trigger_calculate_sale_totals',
    'trigger_calculate_purchase_totals',
    'purchase_final_stock_movement_trigger',
    'sale_final_stock_movement_trigger'
  )
ORDER BY c.relname, tg.tgname;
```

## Migrations to apply (order)

1. `migrations/20260312_fix_stock_movements_legacy_type_column.sql` — stock `movement_type` + canonical final triggers
2. `migrations/20260312_disable_legacy_auto_post_contact_triggers.sql` — this file

## Golden rule (app)

- **Document JEs** (`reference_type` = `sale` / `purchase`): only when `sales.status = final` or `purchases.status IN ('final','received')`.
- **Stock OUT/IN**: final sale / final purchase paths + canonical triggers above; not on draft/quotation.
