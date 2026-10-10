# R8 legacy engine retirement — readiness and blockers

**Status:** BLOCKED — do not retire  
**Generated:** 2026-06-14T00:00:00Z  
**Map:** [`PHASE8_LEGACY_RETIREMENT_MAP.md`](../../../docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md)

---

## Confirmation

| Check | Result |
|-------|--------|
| R8 started this run | **No** |
| Legacy paths removed | **No** |
| Unified loaders live (3 companies) | **Yes** — 5/5 each |
| Legacy fallback available | **Yes** — L1 rollback SQL per loader |

---

## Blockers

1. **Operational stability period** — all approved companies (DIN CHINA, DIN BRIDAL, DIN COUTURE) must remain stable for finance-defined soak period post-baseline  
2. **Finance sign-off** — explicit approval to remove hybrid/read paths  
3. **Engineering sign-off** — consumer audit (`getCustomerLedger`, `roznamchaService`, supplier ledger mirrors, etc.)  
4. **Per-company verification** — no screen still requires legacy synthetic merge  
5. **Rollback strategy** — L1 loader flags + legacy code paths must remain until R8 approval

---

## Required proof before R8

- Continuous operational monitoring PASS for all three profiles over stability window  
- Remaining screens audit shows no hidden legacy dependency for money reports  
- Integrity Lab / tie-out clean for target retirement scope  
- Documented retirement order per Phase 8 map (payment JE linkage → supplier mirror → customer synthetic → …)

---

## Rollback strategy (must remain until R8 approval)

| Company | Rollback |
|---------|----------|
| DIN CHINA | `scripts/single-core-ledger/phase-21x-rollback-*.sql` |
| DIN BRIDAL | `scripts/single-core-ledger/din-bridal/db-rollback-*.sql` |
| DIN COUTURE | `scripts/single-core-ledger/din-couture/dc-rollback-*.sql` |

**Legacy fallback must remain available** — kill switch + loader OFF restores legacy main tables without code deploy.

---

## Verdict

**R8 BLOCKED** — continue periodic monitoring; do not delete legacy services or tables.
