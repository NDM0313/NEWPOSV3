# DATABASE BACKUP AND RESTORE VERIFY

**Verdict: `DATABASE_BACKUP_RESTORE_VERIFIED_PASS`**

**Date:** 2026-09-22  
**Asia/Karachi:** 2026-09-22 19:19:27 PKT  
**UTC:** 2026-09-22 14:19:27 UTC

## Production identity

| Field | Value |
|-------|--------|
| Container | `supabase-db` |
| Image | `supabase/postgres:15.8.1.085` |
| PostgreSQL | **15.8** |
| Database | `postgres` |
| DB size | **290 MB** (303,964,975 bytes) |
| Free disk (pre) | ~4.4 GB on `/` (96% used) |
| Companies | **4** |
| DIN COLLECTION | `e08a04af-22a8-4869-9b4d-da31fce13158` |
| App SHA at backup | `788b50a88371bfd4bb339c01857714452e0dd9c4` |

## Backup location (VPS — outside Git)

`/root/backups/newposv3/20260922-191921/`

| Artifact | Size | SHA-256 |
|----------|------|---------|
| `NEWPOSV3_FULL_20260922-191921.dump` | 21 MB (custom `-Fc`) | `207d0197bf9c2732a1d73059311038fb2097693792278b570614db3136a418fb` |
| `NEWPOSV3_GLOBALS_20260922-191921.sql` | 5.2 KB | `edbb99832599778d8e28dd0e6ba34464d5344d7d5de0a78cc1150aedc92a2193` |
| `NEWPOSV3_SCHEMA_20260922-191921.sql` | 1.9 MB | `0b6212662c1c982bb508e05e77e1386a1d13b1459f7fcf273eaaa9f920a673ed` |
| `SHA256SUMS.txt` | present | — |
| `BACKUP_METADATA.txt` | present | — |
| `PRE_BACKUP_FINGERPRINT.txt` | present | — |

**No dump files committed to Git. No credentials in evidence.**

## Integrity

| Check | Result |
|-------|--------|
| Files non-zero | PASS |
| `pg_restore -l` | PASS (TOC 3476 entries; gzip custom) |
| `TABLE DATA public.journal_entries` | PASS |
| `TABLE DATA public.journal_entry_lines` | PASS |
| `TABLE DATA public.contacts` | PASS |
| `TABLE DATA public.accounts` | PASS |
| `TABLE DATA public.companies` | PASS |

## Pre-backup fingerprint (production RO)

### Global

| Table | Count |
|-------|-------|
| companies | 4 |
| branches | 7 |
| contacts | 430 |
| accounts | 697 |
| journal_entries | 6536 |
| journal_entry_lines | 13471 |
| sales | 167 |
| sale_items | 0 |
| purchases | 23 |
| purchase_items | 158 |
| payments | 841 |
| expenses | 123 |

Optional present: `rentals`, `rental_items`, `workers`.

### DIN COLLECTION

| Metric | Value |
|--------|--------|
| JE count | 5062 |
| JE non-void | 5049 |
| JEL count | 10124 |
| Σ debit | **875,502,523.57** |
| Σ credit | **875,502,523.57** |
| Dr − Cr | **0.00** |
| JE date range | 2002-11-15 → 2026-09-20 |
| accounts | 247 |
| contacts | 138 |
| payments | 109 / total 22,116,000.00 |

## Isolated restore test

| Field | Value |
|-------|--------|
| Restore DB | `newposv3_restore_verify_20260922_191921` |
| Traffic | **NOT** pointed at restore DB |
| Restored size | ~249 MB |
| Compare result | **PASS** |

Critical pre vs restored (identical):

| Key | Pre | Restored |
|-----|-----|----------|
| journal_entries | 6536 | 6536 |
| journal_entry_lines | 13471 | 13471 |
| companies / contacts / accounts | 4 / 430 / 697 | same |
| DIN je_count / jel_count | 5062 / 10124 | same |
| DIN Σ debit / credit | 875502523.57 | same |
| DIN Dr−Cr | 0.00 | same |

Restore DB **dropped after evidence** to free disk. Production DB untouched.

## Off-host second copy

| Field | Value |
|-------|--------|
| Path | `C:\ERP_BACKUPS\NEWPOSV3\20260922-191921\` |
| Status | **OFF_HOST_SHA_MATCH** |
| Full dump SHA | matches VPS `207d0197…a418fb` |

## Production mutation during backup

**NONE** (dump / create isolated restore DB / drop restore DB only).

## Gate

**`DATABASE_BACKUP_RESTORE_VERIFIED_PASS`**

Proceed to Phase 1 (party read-view alignment) is authorized by this gate.
