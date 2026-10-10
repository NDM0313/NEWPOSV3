-- Phase 3D — disable BS/P&L unified loaders (rollback all three companies)

UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id IN (
  '30bd8592-3384-4f34-899a-f3907e336485',
  '597a5292-14c8-4cd8-96bd-c61b5a0d8c92',
  '2ab65903-62a3-4bcf-bced-076b681e9b74'
)
AND feature_key IN (
  'unified_ledger_loader_balance_sheet',
  'unified_ledger_loader_profit_loss',
  'unified_ledger_screen_balance_sheet',
  'unified_ledger_screen_profit_loss'
);
