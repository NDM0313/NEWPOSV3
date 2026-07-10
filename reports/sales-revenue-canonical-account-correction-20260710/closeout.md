# Sales Revenue 4000 Canonical Correction — Closeout

**Date:** 2026-07-10  
**Scope:** OLD ERP / DIN Collection ERP only  
**Status:** **COMPLETE**

## Outcome

| Item | Result |
|------|--------|
| Canonical future sales revenue | **4000** |
| Fallback when 4000 absent | **4100** |
| Production live posting proof | **PASS** — SL-0010 / JE-0316 |
| Post-correction drift | **NO_DRIFT** |
| Observation window | **CLOSED** |

## Timeline

| Step | Commit / evidence | Status |
|------|-------------------|--------|
| 1. Read-only audit + operator decision | `8adf5ff2` | complete |
| 2. Code: `getCanonicalSalesRevenueAccount()` → 4000 | `8adf5ff2` | complete |
| 3. Deploy to production | VPS | complete |
| 4. Post-correction drift watch | `963470b0`, `post-correction-drift-check.md` | complete |
| 5. Monitoring stabilization | `6281fcc4` | complete |
| 6. Operator-approved test sale | SL-0010 | complete |
| 7. First real sale 4000 proof | `23fb615d` | complete |
| 8. Final drift + closeout | this pack | complete |
| 9. Three-company monitoring (post-proof) | `three-company-monitoring-2026-07-10T19-45-35-284Z.md` | **PASS** |

## Production proof (SL-0010)

| Field | Value |
|-------|-------|
| Company | DIN CHINA |
| Invoice | SL-0010 |
| Total | Rs. 500.00 |
| Finalized | 2026-07-10T19:34:27Z |
| Journal | JE-0316 (balanced) |
| Revenue | **4000** — Cr 500.00 |
| 4100 credit | **none** |

## What remains blocked (by design)

| Item | Gate |
|------|------|
| DIN CHINA historical 4100 → 4000 reclass | `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2` |
| R8-R2 legacy code deletion | separate approval |
| Play Store release | separate approval |
| Account deactivation (4000/4100) | not approved |

## Future sale returns

- New sale returns should reverse revenue on **4000** (same canonical helper)
- No post-correction sale_return JEs yet — natural return observation remains open but **not blocking** closeout

## Safety attestation

| Item | Status |
|------|--------|
| DB migrations run | no |
| Transfer JE run | no |
| GL repairs run | no |
| Production GL mutation by closeout docs | no |
| 4000 deactivated | no |
| 4100 deactivated | no |
| R8-R2 run | no |
| Play Store upload | no |

## Evidence index

- [`first-real-sale-4000-proof.md`](first-real-sale-4000-proof.md)
- [`post-correction-drift-check.md`](post-correction-drift-check.md)
- [`read-only-canonical-audit.md`](read-only-canonical-audit.md)
- [`docs/accounting/SALES_REVENUE_CANONICAL_4000_CORRECTION_2026-07-10.md`](../../docs/accounting/SALES_REVENUE_CANONICAL_4000_CORRECTION_2026-07-10.md)
