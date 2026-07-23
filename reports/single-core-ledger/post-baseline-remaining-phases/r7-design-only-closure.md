# R7 design-only closure pack

**Status:** DESIGN ONLY — not applied  
**Generated:** 2026-06-14T00:00:00Z  
**Design doc:** [`SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md)

---

## Confirmation

| Check | Result |
|-------|--------|
| R7 migration file in `migrations/` | **None** |
| R7 applied on production | **No** |
| Live roznamcha unified main | Parity assembler (`assembleRoznamchaUnifiedParityMain`) — production golden values match legacy UI |
| This run applied R7 | **No** |

---

## Approvals required before R7 can start

1. **Design review** — finance + engineering sign-off on roznamcha semantic change  
2. **Migration approval** — additive SQL under `migrations/` reviewed per system lockdown rules  
3. **Per-company golden capture** — roznamcha In/Out/Closing parity vs legacy  
4. **Clone validation** — shadow compare PASS on staging clone  
5. **Production backup** — pre-apply snapshot  
6. **Staged apply** — one company at a time with monitoring  
7. **Three-company regression** — din-china, din-bridal, din-couture monitoring PASS after any semantic change

---

## Risk if applied prematurely

- Roznamcha Cash In/Out/Closing totals could diverge from finance-approved golden fixtures  
- Trial Balance and party screens unaffected directly, but finance reports relying on roznamcha semantics would drift  
- Rollback requires loader L1 scripts + possible RPC revert migration

---

## Recommended future R7 process

```
design review → finance approval → migration approval → clone validation
→ production backup → staged apply (one company) → MONITORING_PROFILE monitoring
→ regression all three companies → soak → sign-off
```

**Stop:** Do not apply R7 in operational monitoring or archive runs.
