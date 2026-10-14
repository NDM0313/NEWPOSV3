-- Rollback for 20260923-unbalanced-je-closeout (DO NOT run unless POST verify fails)
-- Restores exact prior JE/JEL state for allowlisted mutations only.
BEGIN;

-- Undo China insert
DELETE FROM journal_entry_lines
WHERE id = 'a1c4e901-0923-4001-8001-55b744a8c001'
  AND journal_entry_id = '55b744a8-80fb-476f-8203-862bc7a499b9';

-- Undo COGS updates
UPDATE journal_entry_lines SET debit=0, credit=0
WHERE id='093caac9-c2cc-4636-a5e3-a2de114efeb5'
  AND journal_entry_id='f1bda1df-2dc9-474a-9447-08d569863ae9';
UPDATE journal_entry_lines SET debit=0, credit=0
WHERE id='972ed0e4-1f41-4388-ba55-042ba9207459'
  AND journal_entry_id='bdebfa9a-66a0-482c-8699-4a46fab752da';

-- Undo sales revenue bumps
UPDATE journal_entry_lines SET credit=38000.00
WHERE id='af6798de-130a-4ac7-b04f-b0739ddf9a2b'
  AND journal_entry_id='ec281abf-e4e1-40ee-bafe-8f4d4f300a63';
UPDATE journal_entry_lines SET credit=38000.00
WHERE id='ad52d499-d4fa-4e4a-a324-14aa33b245c1'
  AND journal_entry_id='e0712d12-3248-415c-84e1-d8f295aefcda';
UPDATE journal_entry_lines SET credit=14600.00
WHERE id='bd82ef18-a355-46b4-8f82-e8d6a449fe52'
  AND journal_entry_id='ef161c9d-fc5d-45f6-b157-055468d49f4c';

-- Restore deleted Extra Service lines from VPS CSV:
-- /root/backups/newposv3/20260923-005428/targeted_export/rollback/pre_mutated_lines.csv
-- (re-INSERT the four deleted 4120 rows by id)

-- COMMIT only after verifying PRE fingerprints restored.
