# Limited repair package — IBRAHIM residual + ID LACE only

**Date:** 2026-09-19  
**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Status:** READ-ONLY scripts — **do not apply** until owner approves + posting guard migration is live.

## Candidates (revised)

| Party | Class | Action |
|---|---|---|
| IBRAHIM BNRS `SUP-ZHD-0026` | B | Remap **2** leftover JE lines on retired `210026` → `AP-SUPZHD0026` |
| ID LACE `SUP-ZHD-0027` | C | Optional full legacy→AP remap after owner OK |
| DHL / KIRAN / SHAHMIM | R hold | **Excluded** |
| DHL PK | E | **Excluded** (separate contact) |

## Prerequisites before apply

1. Deploy / apply migration `20260919140000_journal_posting_account_guard_and_verified_remaps.sql` (seeds remaps from `backup_coa_merge_20260916.merge_pairs`).
2. Confirm `journal_account_verified_remaps` contains `210026` → `AP-SUPZHD0026`.
3. New backup schema (do **not** overwrite `backup_coa_merge_20260916`).
4. Run `00_readonly_verify.sql` — row counts must match manifest.

## Deploy / repair order

1. Ship app + migration (guards) — no line remaps yet.  
2. Staging smoke: retired UUID → remap or reject; General JE party assist; attributed components on Account Statements.  
3. Owner approves Class B (and optionally C).  
4. Run `01_backup.sql` → `02_apply.sql` → verify → keep `03_rollback.sql` ready.  

## Rollback

`03_rollback.sql` restores **only** remapped `journal_entry_lines.id` values from the new backup — never a blind Sept16 re-merge.
