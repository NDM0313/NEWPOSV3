# RESULT — Accounting Integrity Test Lab

See the full deliverable: **[ACCOUNTING_INTEGRITY_LAB_RESULT.md](./ACCOUNTING_INTEGRITY_LAB_RESULT.md)** (Phase 2 + tooling: payables status filter, **purchase by-id / getPurchase 400**, **`CustomerLedgerInteractiveTest` lazy**, snapshot timestamps/outcome).

## Latest integrity outcome (unbalanced JE repair)

- Root cause JEs: `dc2fd0f9-dd66-4e52-876c-bad2021bcfe7` (diff 3000) and `4bce1498-bae8-40d8-9eb5-a3aca8d0239f` (diff 10000), both legacy EXP sale vouchers with debit-only lines.
- Live-data repair: `migrations/20260320_void_legacy_unbalanced_exp_sale_je.sql` (targeted void, no delete, traceable reason).
- Post-repair: unbalanced JEs `0`, Trial Balance diff `0.00`.
- Remaining (separate phase): BS diff `283800`, AR diff `203400`, AP diff `-865770`, payment-link gap `1` row.

## Git commit hash

Run after pulling:

```bash
git log -1 --oneline
```
