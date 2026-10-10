# ID LACE Class-C repair package design (DRAFT ONLY)

**Status:** DESIGN ONLY — **DO NOT EXECUTE ON PRODUCTION**  
**Related discovery:** [`../ID_LACE_CLASS_C_DISCOVERY.md`](../ID_LACE_CLASS_C_DISCOVERY.md)  
**Verdict driving this stub:** `ID_LACE_CLASS_C_NOT_READY` (0 ELIGIBLE lines)

## Purpose

Document how an Ibrahim-like package **would** be structured **if** a future evidence refresh found ELIGIBLE legacy lines. Current live evidence has an **empty** allowlist.

## Isolated naming (must not reuse Ibrahim)

| Artifact | Proposed name |
|----------|----------------|
| Backup schema | `backup_coa_id_lace_class_c_v1` |
| Run ID prefix | `id_lace_v1_YYYYMMDDHHMMSS` |
| Scope constant | `ID_LACE_CLASS_C_ONLY` |
| Manifest | exact `journal_entry_lines.id` allowlist (currently **empty**) |
| Target account | `AP-SUPZHD0027` / `30bbe521-5773-4985-8be1-0d336c56a6a3` |
| Source account (if any) | `210027` / `e11d244a-b96e-4128-8ca3-2bae5a4f813c` |

## Required future scripts (not written as prod-runnable here)

1. `01_backup.sql` — create durable schema; snapshot pre lines; refuse if schema exists with different run; set `id_lace_status` appropriately.
2. `02_apply.sql` — transaction + row locks; verify company; verify each allowlisted line still on expected source account with exact debit/credit fingerprint; update `account_id` only; write post snapshot; idempotent if already on target.
3. `03_rollback.sql` — restore from pre snapshot with drift checks; idempotent; never touch other parties.
4. Isolated PostgreSQL tests — empty-manifest no-op; refuse wrong company; refuse amount drift; refuse other-party contamination.
5. Production preflight / post-verify — RO queries matching discovery invariants + `TOTAL_GL_EFFECT = 0`.

## Current apply gate

```
IF eligible_line_count = 0 THEN
  ABORT with 'ID_LACE_NO_ELIGIBLE_LINES';
END IF;
```

Until that gate can pass under a **new** owner-approved evidence package, **no** `02_apply.sql` may run in production.

## Explicit non-goals

- Do not deactivate/unlink beyond what verified remaps already cover without separate approval.
- Do not mutate DHL / KIRAN / SHAHMIM / Ibrahim.
- Do not invent corrective JEs.
- Do not copy Ibrahim run_id or line IDs.
