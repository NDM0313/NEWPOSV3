SELECT feature_key, enabled FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE '%ledger_v2%';
