# Production UI verification

1. Page assets deploy: ArApReconciliationCenterPage-*.js present with 'Parity baseline' string — YES
2. Unified source remains active (flags ON; VITE_BUILD_COMMIT a5149971) — YES
3. Operational basis label: effective_party (code) — YES
4. Parity baseline shows official_gl — YES (bundle)
5. Admin parity chip: PASS when official_gl Δ<=0.01 — expected YES
6. COUTURE / BRIDAL / CHINA official_gl parity PASS (SQL) — YES
7. Explained EP variance documented — YES
8. Legacy + kill-switch fallback retained in code — YES
9. Contacts page unchanged — YES
10. Exception queues / repair unchanged — YES

Browser console walkthrough: admin chip PASS inferred from official_gl Δ0 + deployed labels; no GL mutation.
