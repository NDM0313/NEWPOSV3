-- Phase 2.10A — pre-flight read-only: DIN CHINA unified_ledger flags (loader NOT enabled yet)
SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;

-- Expect before Stage 3 enable:
--   unified_ledger_pilot = true
--   unified_ledger_engine = true
--   unified_ledger_screen_ledger_v2 = true
--   unified_ledger_loader_ledger_v2 = absent OR false
--   unified_ledger_kill_switch = absent OR false
