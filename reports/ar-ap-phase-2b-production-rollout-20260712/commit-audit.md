# AR/AP Phase 2b — Commit audit

**Audited commit:** `75c12cd73ff31d5698c5eceb2582a019e732ee6f`
**Message:** feat(accounting): wire AR/AP center party GL to unified engine (Phase 2b)
**Date:** 2026-07-12

## Baseline git state (pre-push)

| Item | Value |
|------|-------|
| Branch | `main` |
| Local HEAD | `75c12cd7` |
| origin/main | `8bbb01f0` (1 commit behind local) |
| Staged files | none |
| Commit exists locally | yes |
| Already on origin/main | no |

## File classification (16 files)

### AR/AP Phase 2b runtime (8)
| File | Action |
|------|--------|
| `src/app/services/arApUnifiedPartyBalanceService.ts` | Add |
| `src/app/services/arApReconciliationCenterService.ts` | Modify |
| `src/app/lib/arApPartyGlParity.ts` | Add |
| `src/app/components/accounting/ArApReconciliationCenterPage.tsx` | Modify |
| `src/app/components/accounting/ar-ap-repair/PayablesVarianceExplainerPanel.tsx` | Modify |
| `package.json` | Modify (test script entry) |

### Additive migration (1)
| File | Action |
|------|--------|
| `migrations/20260712120000_get_unified_contact_party_gl_balances.sql` | Add |

### Tests (1)
| File | Action |
|------|--------|
| `src/app/lib/arApPartyGlParity.test.ts` | Add |

### Script (1)
| File | Action |
|------|--------|
| `scripts/single-core-ledger/run-ar-ap-unified-party-parity-readonly.mjs` | Add |

### Docs (2)
| File | Action |
|------|--------|
| `docs/accounting/AR_AP_RECONCILIATION_CENTER.md` | Modify |
| `docs/accounting/SINGLE_CORE_ENGINE_CLOSEOUT_FINAL_2026-07-12.md` | Modify |

### Evidence — wireup session (5)
| File | Action |
|------|--------|
| `reports/ar-ap-phase-2b-unified-wireup-20260712/*` | Add |

## Excluded from commit (local WIP — not pushed)

- `erp-mobile-app/**` (Capacitor, Roznamcha, reports hub, IPA builds)
- `graphify-out/**`
- Unrelated `src/app/services/accountingService.ts`, `roznamchaService.ts`
- Unrelated migrations, sales-revenue closeout, R8-R2 drill reports
- `.env`, credentials, keystores, APK/IPA binaries

## Sensitive / unsafe files in commit

None detected.

## Replacement commit required?

No. Commit `75c12cd7` contains only Phase 2b scoped files.
