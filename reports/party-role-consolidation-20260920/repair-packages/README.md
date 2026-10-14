# Repair package scaffolds (PREVIEW ONLY — do not apply)

Independent packages; UUID identity only; IBRAHIM schemas forbidden.

Each future package directory should contain:

- `00_readonly_verify.sql`
- `01_backup.sql` → unique schema `backup_coa_<party>_<role>_v1`
- `02_apply.sql` (account_id moves / leaf create only)
- `03_rollback.sql` via `repair_restore_journal_entry_line_account`
- `LINE_MANIFEST.csv` from reviewed classification
- `README.md`

Do not implement apply SQL until staging approval. Classification source: `../HISTORICAL_LINE_CLASSIFICATION.csv`.
