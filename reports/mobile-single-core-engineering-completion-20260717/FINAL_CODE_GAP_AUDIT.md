# FINAL_CODE_GAP_AUDIT.md

| Item | Classification | Notes |
|------|----------------|-------|
| Contact balance GL→operational fallback | DOCUMENTED_RESIDUAL | Explicit in contactBalancesRpc; list rows still unlabelled operational downgrade |
| Sale edit invalidation | COMPLETE | Upgraded to `invalidateAfterAccountingWrite` |
| Purchase edit invalidation | COMPLETE | Upgraded to `invalidateAfterAccountingWrite` |
| Sale void invalidation | COMPLETE | Wired in `cancelSale` |
| Purchase void invalidation | COMPLETE | Wired in `cancelPurchase` |
| Sale return invalidation | COMPLETE | Wired after finalize |
| Rental payment invalidation | COMPLETE | Wired after RPC success |
| Worker payment invalidation | SAFE_EXISTING_BEHAVIOUR | Already wired |
| Studio-finalize invalidation | COMPLETE | Wired after sale GL finalize |
| Account transfer invalidation | SAFE_EXISTING_BEHAVIOUR | Via `createJournalEntry` |
| Client journal helpers | DOCUMENTED_RESIDUAL | Keep; see CLIENT_ACCOUNTING_HELPERS.md |
| Role-denial error rendering | SAFE_EXISTING_BEHAVIOUR | Client gates + fail-loud reports |
| Branch/company state clearing | COMPLETE | Branch switch now clears list caches + epoch |
| Report refresh on app resume | SAFE_EXISTING_BEHAVIOUR | AccountsModule visibility/focus epoch |
| PDF/share compatibility | SAFE_EXISTING_BEHAVIOUR | Existing preview paths; DEVICE_GATED for APK proof |
| Android release configuration | SAFE_EXISTING_BEHAVIOUR | Unsigned release when keystore absent |
| Account Ledger unified→legacy notice | COMPLETE | Fail-loud amber notice on unified error |
| Aging query fail-loud | COMPLETE | Propagates Supabase error; not empty success |
| Salesman / Limited / branch live RLS | APPROVAL_GATED / RESOURCE_GATED | Not code defects |
| Emulator / physical device QA | DEVICE_GATED | Not code defects |

**CODE_CHANGE_REQUIRED discovered this phase:** Account Ledger silent fallback; Aging empty-on-error; missing write invalidation coverage — **all resolved above**.
