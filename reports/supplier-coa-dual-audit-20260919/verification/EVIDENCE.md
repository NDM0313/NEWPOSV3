# JE account guard — isolated Postgres evidence

- Generated: 2026-09-19T09:00:49Z
- Production writes: none
- Runner: Docker postgres:15

## 1. Minimal schema
- applied 00_minimal_schema.sql

## 2. Migration apply
NOTICE:  policy "journal_account_verified_remaps_select_company" for relation "public.journal_account_verified_remaps" does not exist, skipping
NOTICE:  policy "journal_account_guard_events_select_company" for relation "public.journal_account_guard_events" does not exist, skipping
NOTICE:  journal_account_verified_remaps: backup merge_pairs ABSENT â€” seed skipped (0 rows)
NOTICE:  trigger "trg_guard_journal_entry_line_account" for relation "public.journal_entry_lines" does not exist, skipping
NOTICE:  trigger "trg_accounts_reject_company_reassign_with_lines" for relation "public.accounts" does not exist, skipping
NOTICE:  trigger "trg_journal_entries_reject_company_reassign" for relation "public.journal_entries" does not exist, skipping
COMMIT
- migration apply: OK

## 3. Triggers on journal_entry_lines
- trg_guard_journal_entry_line_account

## 4. Cases
NOTICE:  PASS: retired without remap rejected
NOTICE:  PASS: insert remapped + event
NOTICE:  PASS: non-key update preserved account
NOTICE:  PASS: explicit same active account_id update ok
NOTICE:  PASS: wrong-company rejected
NOTICE:  PASS: journal_entry_id reassignment revalidated
NOTICE:  PASS: conflicting second insert unique-blocked
NOTICE:  PASS: remap identity mismatch rejected
NOTICE:  PASS: allow_inactive_restore rollback path
NOTICE:  PASS: account company reassign blocked
NOTICE:  PASS: JE company reassign blocked
NOTICE:  PASS: resolver execute ACLs (authenticated/service_role yes, anon no)
NOTICE:  ALL_ISOLATED_CHECKS_PASSED
- cases: PASSED

## 5. Environment notes
- Production: guard NOT installed (read-only MCP before this run).
- Staging JWT matrix: UNVERIFIED.
- Missing backup seed path: NOTICE showed ABSENT — 0 rows (verified in migration apply).
- Vitest fixtures: separate from this SQL run.
