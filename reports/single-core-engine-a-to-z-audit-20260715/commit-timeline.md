# Single Core Engine — Commit / Phase Timeline

**Audit date:** 2026-07-15
**Repo HEAD:** `5cf65f4c`
**Status vocabulary:** COMPLETE | OPERATIONAL COMPLETE | DEVELOPMENT COMPLETE | GITHUB COMPLETE | PRODUCTION COMPLETE | PARTIAL | BLOCKED | DEFERRED | SUPERSEDED | OUT OF SCOPE | UNKNOWN

| Phase | Date | Branch | Commit | Objective | Status | Still relevant | Blocker / note |
|-------|------|--------|--------|-----------|--------|----------------|----------------|
| Phase 0 baseline / master plan | 2026-06 | main | plan packs under `docs/accounting/SINGLE_CORE_LEDGER_*` | Define migration Phases 0–5 | COMPLETE | Yes (historical) | — |
| Phase 1–1.8 RPCs | 2026-06 | main | `20260620140000_*`, `20260621150000_*` | Unified party/account/cash/TB RPCs | PRODUCTION COMPLETE | Yes | Additive |
| Phase 2.1–2.8 preview | 2026-06 | main | Phase 2 rollout docs | Flags, Admin Compare, preview surfaces | SUPERSEDED | History | Superseded by loader swaps |
| Phase 2.9 / 2.9A Cash-Bank parity | 2026-06 | main | compare services | Cash/bank Admin Compare | OPERATIONAL COMPLETE | Yes (diagnostic) | — |
| Phase 2.10 Ledger V2 loader | 2026-06/07 | main | loader + `3e9c8b19`/`5c2610e0` | Main loader swap Ledger V2 | OPERATIONAL COMPLETE | Yes | Prod flags ON |
| Phase 2.11 Account Statement | 2026-06/07 | main | AS loader commits | Main loader swap AS | OPERATIONAL COMPLETE | Yes | Hybrid customer legacy remains as fallback |
| Phase 2.12 Trial Balance | 2026-06/07 | main | TB loader | Main loader swap TB | OPERATIONAL COMPLETE | Yes | — |
| Phase 2.13 Party Ledger | 2026-06/07 | main | PL loader | Main loader swap Party Ledger | OPERATIONAL COMPLETE | Yes | — |
| Phase 2.14 Roznamcha | 2026-06/07 | main | Roznamcha loader | Main loader swap Roznamcha | OPERATIONAL COMPLETE | Yes | Separate Roznamcha WIP out of audit |
| Phase 2.15 recovery | 2026-07 | main | cash-bank/roznamcha recovery | Recover parity regressions | COMPLETE | Yes | — |
| Phase 2.16 monitoring / goldens | 2026-07-01…12 | main | `8bbb01f0`, bridal goldens | Operational monitoring stability | OPERATIONAL COMPLETE | Yes | Snapshot goldens can drift with live GL |
| Phase 2.17–2.18 release governance / merge | 2026-06/07 | main | rollout docs | Governance | COMPLETE | Yes | — |
| Phase 3A BS/P&L preview | 2026-06/07 | main | BS/P&L preview | Preview from unified TB | SUPERSEDED | History | Superseded by 3D main loaders |
| Phase 3B Cash Flow | 2026-07 | main | 3B-M loader swap | Cash Flow main unified | OPERATIONAL COMPLETE | Yes | — |
| Phase 3D BS/P&L main loaders | 2026-07 | main | BS/P&L loader flags | Finance statements canonical | OPERATIONAL COMPLETE | Yes | Error fallback to legacy retained |
| Phase 2b AR/AP party GL | 2026-07-11/12 | main | `75c12cd7`, `aff7c1d3`, `c20672c3` | Unified party balance for AR/AP Center | PARTIAL | Yes | DIN BRIDAL `effective_party` FAIL |
| Admin Compare / Tie-out | ongoing | main | compare services | Shadow / diagnostic | OPERATIONAL COMPLETE | Yes | DIAGNOSTIC |
| Calendar stability Days 1–6 | 2026-07-01… | main | day packs | Early stability | SUPERSEDED | No | Official Days 7–15 supersede |
| Calendar Days 7–15 | 2026-07-06…08 | main | `6e179412`…`4665334b` | Official 15-day window | COMPLETE | Yes | Prerequisite for R8 |
| R6 monitoring hardening | 2026-07 | main | `6281fcc4`, `ba7dadd7` | Flake/credential hardening | COMPLETE | Yes | — |
| Sales Revenue 4100→4000 correction | 2026-07-10/11 | main | `8adf5ff2`…`84eb1363` | Canonical future revenue 4000 | PRODUCTION COMPLETE | Yes | Locked: no blanket 4100 reclass |
| R8-R1 operational retirement | 2026-07-10 | main | `bc4528e5` | Unified loaders canonical; code retained | OPERATIONAL COMPLETE | Yes | — |
| Salesman login QA | 2026-07-09 | main | `44154031` | Device login PASS | COMPLETE | Outside core | — |
| Salesman extended QA | 2026-07-11 | main | `74e357f6` (+ mixed `6421c898`) | Rows 4–20 PASS | COMPLETE | Outside core | Play Store not released |
| Supplier Discount JE-0028 | 2026-07-11/12 | main | closeout claims | 5210 + JE-0028 PKR1 | PARTIAL | Yes | Claimed COMPLETE; evidence folder **MISSING from git** |
| Sales Revenue Phase 2 reclass decision | 2026-07-12 | main | closeout | Preserve China 4100 historical | PARTIAL | Yes | Decision documented; evidence folder **MISSING** |
| R8-R2 kill-switch drill | 2026-07-12 | main | closeout claim | Read-only drill PASS | PARTIAL | Yes | Claimed PASS; evidence folder **MISSING**; readiness plan still says NOT DONE |
| R8-R2 code deletion | — | — | — | Delete thin LegacyMain wrappers | DEFERRED | Yes | Soak until **2026-08-09**; need approval |
| Play Store upload | — | — | — | Publish APK/AAB | OUT OF SCOPE | Yes (optional) | SKIPPED 2026-07-12 |
| Phase 4–5 enablement / deprecation (master) | future | — | plan v3 | Global engine / retire engines | FUTURE / OUT OF SCOPE | Partial overlap with R8-R2 | Not program-complete required |
| Phase 8 table/UI map | future | — | `PHASE8_LEGACY_RETIREMENT_MAP.md` | Broader retirement | OUT OF SCOPE | Yes | Distinct from R8-R1/R2 |
| Contacts unified party GL | — | — | — | Switch Contacts off legacy RPC | FUTURE / OPTIONAL | Extension | Still `get_contact_party_gl_balances` |
| Mobile unified first wave | deferred | — | Phase 2.mobile | Mobile loaders | OUT OF SCOPE | Optional | Not core closeout |

## Key commit categories (Jul 2026)

| Commit | Subject | Categories |
|--------|---------|------------|
| `694af3b9` | office pull verify @ 84eb1363 | docs + evidence |
| `6421c898` | roznamcha entry | **MIXED** mobile+web+evidence+docs |
| `511044a1` | salesman device-blocked | docs |
| `74e357f6` | salesman extended QA close | docs + evidence |
| `8bbb01f0` | DIN CHINA Phase 2.16 golden | scripts + fixtures + evidence |
| `75c12cd7` | AR/AP Phase 2b wireup | migration + runtime + scripts |
| `aff7c1d3` | AR/AP rollout evidence | docs + evidence |
| `c20672c3` | bridal parity fail | docs + evidence |
| `5cf65f4c` | roznamcha entr2y (current HEAD) | runtime (post-SCE; VPS matched) |

## Timeline totals (this audit classification)

| Bucket | Count |
|--------|------:|
| Total phases / tracks listed | 35 |
| COMPLETE / OPERATIONAL / PRODUCTION / DEVELOPMENT / GITHUB (done class) | 26 |
| PARTIAL | 4 |
| BLOCKED | 0 (Bridal is PARTIAL under extension, not core block) |
| DEFERRED | 1 (R8-R2 deletion) |
| SUPERSEDED | 3 |
| OUT OF SCOPE / FUTURE | 5 |
