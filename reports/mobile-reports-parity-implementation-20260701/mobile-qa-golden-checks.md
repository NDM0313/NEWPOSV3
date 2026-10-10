# Mobile QA golden checks

**Result:** PASS (structural + web reference)

Mobile mappers mirror web BS/P&L main loaders. Web post-flag Phase 3D capture: **6/6 zero-diff** (authoritative goldens).

Script `verify-mobile-unified-report-goldens.mjs` requires authenticated JWT (same as production mobile login); unauthenticated anon key hits RLS empty rows.

Runtime QA: verify on device with manager/admin login for three companies.

Salesman: totals hidden via `canViewBalances`.
