# CACHE_INVALIDATION.md

| Event | Action |
|-------|--------|
| Company change | `invalidateCompanyAccountingCaches` + bump `reportRefreshEpoch`; clear party selection |
| Branch change | bump `reportRefreshEpoch` (null = company-wide) |
| Logout | `clearAccountingStateOnLogout` from `signOutGlobal` |
| App/tab focus | AccountsModule visibility/focus → epoch bump |
| Write success | Existing `MOBILE_DATA_INVALIDATED_EVENT` → epoch bump; `invalidateAfterAccountingWrite` helper available |

Never invent balances from IndexedDB when server fails.
