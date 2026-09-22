# Mixed Commit and Git Hygiene Audit

**Audit date:** 2026-07-15
**Action:** no history rewrite

## `6421c898` — `roznamcha entry` (2026-07-11)

| Field | Value |
|-------|--------|
| Files | ~85 (+7477/−5020) |
| Categories | evidence (salesman QA + monitoring), mobile (payments/PIN/notes), runtime-web (Roznamcha/Ledger V2/payment UI), docs (gates + Play Store), graphify |
| Migrations | none |
| Production impact | Runtime-web + mobile changes shipped when later HEADs deployed; now on VPS `5cf65f4c` lineage |
| Deployed | YES (current VPS matches later HEAD including this ancestor) |
| Safe to keep | YES (historical kitchen-sink) |
| Needs cleanup | Soft: document as mixed; do not split via rewrite |
| Needs revert | NO |
| No action required | **YES** for this audit |

## Other suspicious / mixed patterns

| Commit | Notes | Action |
|--------|-------|--------|
| `5cf65f4c` / `950d654b` `roznamcha entr2y` | Runtime roznamcha work after SCE closeout docs | Unrelated WIP continues locally; **exclude** from audit commit |
| `aff7c1d3` then `c20672c3` | Docs-only AR/AP evidence sequence — clean | Keep |
| `75c12cd7` | Feature+migration+scripts — appropriate mixed feature commit | Keep |
| Calendar day evidence commits | Docs/evidence heavy — normal | Keep |

## Hygiene rules for SCE closeout documentation

- Prefer docs/evidence-only commits for status claims.
- Do not amend mixed history.
- Flag missing evidence folders rather than inventing packs.
