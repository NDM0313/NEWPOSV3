-- ============================================================================
-- App-side accounting engine: disable legacy DB triggers that duplicate JEs
-- ============================================================================
-- When BOTH run:
--   - trigger_auto_post_sale_to_accounting (functions.sql) inserts journal_entries
--   - saleAccountingService.createSaleJournalEntry (app) inserts the same reference
-- you get duplicate lifecycle, 409 conflicts (unique fingerprint / race), and
-- mixed semantics (subtype-based lines vs Phase-4 COA).
--
-- Stock triggers: use migrations/20260312_fix_stock_movements_legacy_type_column.sql
-- (drops trigger_update_stock_on_sale / trigger_update_stock_on_purchase).
--
-- RETAINED (non-accounting): trigger_calculate_sale_totals, trigger_calculate_purchase_totals
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_post_sale_to_accounting ON public.sales;
DROP TRIGGER IF EXISTS trigger_auto_post_purchase_to_accounting ON public.purchases;
DROP TRIGGER IF EXISTS trigger_update_contact_balance_on_sale ON public.sales;
DROP TRIGGER IF EXISTS trigger_update_contact_balance_on_purchase ON public.purchases;
