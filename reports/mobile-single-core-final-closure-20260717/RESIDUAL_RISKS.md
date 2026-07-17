# RESIDUAL_RISKS.md

1. Salesman live RLS blocked — missing secure password env.
2. Limited/branch live RLS blocked — identities unavailable; Path A/B approvals not given.
3. Emulator environment unavailable (system ANR; login automation FAIL).
4. Physical device QA not run.
5. Salesmen have zero `user_branches` — confirm branch policy during live Salesman RLS.
6. Dirty `main @ 812c2871` must not be merged into.
