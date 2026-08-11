# Import FX Case — W1 hold and Wave 0 verify

**Date:** 2026-08-11  
**Scope:** Wave W1 only (case/stage persistence + draft UI).  
**Gates:** `multiCurrencyEnabled` ops · `fxSettlementAccountingEnabled = false` (Profile A).

---

## Wave 0 verification (repo source of truth)

Migration present in repo:

[`migrations/20260811200000_import_fx_wave0_path21_idempotency_settlement_lifecycle.sql`](../../migrations/20260811200000_import_fx_wave0_path21_idempotency_settlement_lifecycle.sql)

Confirms:

- `fx_currency_purchases.client_operation_id` + partial UNIQUE `(company_id, client_operation_id)`
- `import_fx_client_operations` receipt table UNIQUE `(company_id, event_type, client_operation_id)`
- Settlement lifecycle `active` / `inactive` (no DELETE)

**Operator action:** before relying on W1/Path 21 in a target environment, apply Wave 0 (and W1) migrations if not already applied. Live DB MCP was not authenticated during this implement pass; treat deploy verify as a release checklist item:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'fx_currency_purchases' AND column_name = 'client_operation_id';

SELECT to_regclass('public.import_fx_client_operations');
SELECT to_regclass('public.import_fx_cases');
```

---

## W1 shipped (this wave)

| Artifact | Path |
|----------|------|
| Migration | `migrations/20260811230000_import_fx_case_stage_persistence_w1.sql` |
| Service | `src/app/services/importFxCaseService.ts` |
| Helpers/tests | `src/app/lib/importFxCaseHelpers.ts`, `importFxCaseHelpers.test.ts` |
| UI | `src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx` |
| Entry | Purchases → **Import FX Cases** (flag ON); Path 21 **Agent FX** unchanged |
| UX design (copied) | `docs/accounting/IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md` |

**Behavior:** create/list/get draft case; seed stages; save draft; confirm **ARRANGEMENT** only (no journal); cancel unposted; optional Path 21 `fx_currency_purchases.import_fx_case_id` via link RPC.

---

## HOLD — do not implement without separate approval

| Wave | Content |
|------|---------|
| W2 | Advance / funding JE + USD acquisition credit/prepaid against case |
| W3 | China USD transfer + awaiting confirmation |
| W4 | USD→CNY conversion + CNY pool + wallet_movements |
| W5 | Supplier FX open items + multi-supplier allocations (AP reduce on confirm only) |
| W6 | Desktop polish, mobile, dashboards/queues, exports |
| Phase 3 | FX P&L / pending accounts `1395`/`2295`/`6100`/`7100` — lockdown lift required |

Profile A forever until Phase 3 approved: no automatic FX gain/loss, no conversion benefit into Supplier AP, no dual-currency trial balance.

---

## Explicit non-goals of W1

- No money journals from case stages other than none (planning only).
- No removal of Path 21 three-step wizard.
- No mobile Import FX Case UI.
- No pooled allocation engine.
