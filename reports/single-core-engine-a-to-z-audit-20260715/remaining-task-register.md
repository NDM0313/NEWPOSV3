# Remaining Task Register

**Audit date:** 2026-07-15
Duplicates and completed items removed.

| Priority | Task | Scope | Why needed | Blocker | Approval phrase | Migration | Runtime deploy | Prod data mutation | Risk | Complexity | Earliest | Owner action | Done when |
|----------|------|-------|------------|---------|-----------------|-----------|----------------|--------------------|------|------------|----------|--------------|-----------|
| P1 | Investigate DIN BRIDAL Walk-in Customer old Δ 80000 under `effective_party` | Extension AR/AP | Unblock Phase 2b production-complete | Attribution unknown | none for read-only | No | No | No | High | Medium | Now | Read-only JE attribution; re-run parity | Bridal effective_party PASS |
| P1 | Recreate or locate missing evidence for kill-switch drill / JE-0028 / Phase2 reclass | Docs | Contradictory completeness claims | Folders absent | n/a | No | No | No | Med | Low | Now | Commit true evidence packs | Folders exist + match claims |
| P2 | Re-run three-company monitoring with per-company passwords | Core ops | Fresh green after 07-12 | Creds | n/a | No | No | No | Med | Low | Now | Set env; run monitor | PASS artifact dated |
| P2 | After soak: kill-switch drill with operator present | R8-R2 | Prerequisite to deletion | Soak 5/30 | operator presence | No | Maybe rebuild if env kill | Flag toggle only if approved | Med | Medium | **2026-08-09** | Document drill | Drill pack PASS |
| P2 | Obtain `R8_R2_CODE_DELETION_APPROVAL_REQUIRED` then delete thin wrappers | R8-R2 | Full retirement | Soak + drill + approval | `R8_R2_CODE_DELETION_APPROVAL_REQUIRED` | No | Yes if src deleted | No | High | High | ≥2026-08-09 | Follow readiness plan | LegacyMain wrappers gone; tests green |
| P3 | Decide AR/AP basis follow-up (`official_gl` vs fix effective_party) | Extension | Production UI signoff path | Operator choice | explicit basis phrase | Maybe no | Maybe yes | No | High | Medium | After P1 | Choose path | Documented decision |
| P3 | Optional Contacts page switch to unified party GL | Optional | UI consistency | AR/AP decision | phrase TBD | No | Yes | No | Med | Medium | After bridal PASS | Wire resolver | Contacts not legacy-hard |
| P4 | Play Store upload | Mobile | Distribution | Version/privacy/AAB | `PLAY_STORE_FINAL_UPLOAD_APPROVAL_REQUIRED` | No | No (store) | No | Low | Medium | Anytime | Operator | Released |
| P4 | Phase 8 broader retirement / getCustomerLedger | Future | Long-term cleanup | R8-R2 first | Phase 8 approval | Maybe | Yes | No | High | High | After R8-R2 | Separate program | Map complete |

## Buckets

### 1. Mandatory core tasks
- Fresh monitoring PASS when credentials available (ops hygiene; not a flag-off crisis).
- Preserve L0–L2 rollback; do not delete legacy early.

### 2. Mandatory production tasks (extension)
- Bridal `effective_party` resolution before AR/AP production-complete claim.

### 3. Deferred R8-R2
- Soak to 2026-08-09; drill; approval; then deletion wave 1.

### 4. Optional extensions
- Contacts unified RPC; AR/AP basis switch; Phase 8.

### 5. Mobile / Play Store
- Upload when approved — **not core**.

### 6. Data cleanup
- None mandated for SCE closeout (import-gap WIP excluded).

### 7. Documentation only
- Restore missing 2026-07-12 evidence folders or revise closeout claims to match git.
