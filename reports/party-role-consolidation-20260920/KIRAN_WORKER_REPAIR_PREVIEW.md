# KIRAN MUKESH — worker role consolidation preview (NO production apply)

## CURRENT_STATE

| Field | Value |
|-------|--------|
| Contact | KIRAN MUKESH `SUP-ZHD-0036` `797ca8bb-…` |
| Type | `supplier` (**wrong** — owner: worker) |
| GL today | `AP-SUPZHD0036` under **2000** — 68 lines; net Dr **2,250,000** |
| Legacy | `210036` inactive, **0** lines; remap → AP-SUPZHD0036 |
| WP/WA leaves | **none** |
| Purchases | 0 |

## CANONICAL_ROLE

**Worker / artisan** — advance **1180**, work payable **2010**.

## Provisional line classes (heuristic)

See `HISTORICAL_LINE_CLASSIFICATION.csv`:

| Class | Lines | Dr | Cr |
|-------|------:|---:|---:|
| ADVANCE | 58 | 12,626,000 | 0 |
| WORK_PAYABLE | 10 | 0 | 10,376,000 |

Heuristics: OB/payment/journal **debits** → ADVANCE; transfer credits with BILL/CLOSING/TOTAL → WORK_PAYABLE. **Owner must review OTHER_REVIEW and edge descriptions before apply.**

## TARGET_ACCOUNTS

| Class | Target |
|-------|--------|
| ADVANCE | new `WA-*` under **1180** (`resolve`/ensure worker advance leaf) |
| WORK_PAYABLE / SETTLEMENT | new `WP-*` under **2010** |
| OTHER_REVIEW | hold |

## HISTORY_TO_MOVE

All open lines currently on `AP-SUPZHD0036` → WA/WP by class (account_id UPDATE only; amounts/dates/JE headers preserved). Soft-void nothing unless duplicate.

## HISTORY_TO_PRESERVE

JE `reference_type` (journal stays journal; transfer stays transfer; payment stays payment). No fake PAY docs.

## EXPECTED_BALANCE_BEFORE

AP-SUPZHD0036 net Dr 2,250,000 (single leaf).

## EXPECTED_BALANCE_AFTER

- AP-SUPZHD0036 → **0** open lines (or inactive after drain)
- WA net + WP net components reconcile to same economic position (Dr advances − Cr work bills = 2,250,000 net Dr)

## REPORTING_EFFECT

Remove from supplier report; show in worker / attributed multi-leaf view (1180+2010, no double-count).

## ROLLBACK_METHOD

Durable schema `backup_coa_kiran_worker_v1`: manifest of line_id → from_account → to_account; `repair_restore_journal_entry_line_account` per line; contact.type restore to supplier if flipped.

## Package name

`KIRAN_WORKER_ROLE_CONSOLIDATION` — scripts only; staging first.
