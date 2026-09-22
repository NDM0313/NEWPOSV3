# DATABASE BACKUP REFERENCE — unbalanced JE closeout

| Item | Value |
|------|--------|
| Fresh backup dir | `/root/backups/newposv3/20260923-005428/` |
| Timestamp | 2026-09-23 00:54:28 Asia/Karachi |
| Full dump | `NEWPOSV3_FULL_20260923-005428.dump` (~21MB) |
| Schema | `NEWPOSV3_SCHEMA_20260923-005428.sql` |
| Globals | `NEWPOSV3_GLOBALS_20260923-005428.sql` |
| `pg_restore -l` lines | 4224 |
| PRE fingerprint (global Dr−Cr) | −35730.00 (6531 JE w/ lines / 13471 lines) |
| Purpose | Pre-repair gate for DIN CHINA + DIN BRIDAL unbalanced JE integrity |
| Prior verified backup (still valid) | `/root/backups/newposv3/20260922-191921/` restore PASS |

SHA-256 of full dump: see `SHA256SUMS.txt` on VPS (not copied into Git).

**Verdict:** `BACKUP_PASS`
