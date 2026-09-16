# Runtime diff (a5149971)

Files:
- src/app/lib/arApPartyGlParity.ts — AR_AP_PARTY_GL_PARITY_BASIS=official_gl
- src/app/services/arApUnifiedPartyBalanceService.ts — separate operational vs parity fetches
- src/app/services/arApReconciliationCenterService.ts — party_gl_parity_basis / status
- ArApReconciliationCenterPage.tsx + PayablesVarianceExplainerPanel.tsx — labels/chip
- scripts/.../run-ar-ap-unified-party-parity-readonly.mjs — official_gl gate
- tests in arApPartyGlParity.test.ts

No migrations. No RPC SQL change. No GL mutation.
