-- Phase 2.10A L1 rollback — DIN CHINA loader flag OFF (instant legacy main table)
UPDATE feature_flags
SET enabled = false,
    description = 'Phase 2.10 L1 rollback — Ledger V2 main loader reverted to legacy',
    updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_loader_ledger_v2';

-- L2: screen flag OFF — scripts/single-core-ledger/phase-29c-rollback-screen-ledger-v2.sql
-- L3: engine OFF — scripts/single-core-ledger/phase-29c-rollback-engine.sql
-- L4: kill switch ON — insert unified_ledger_kill_switch = true
