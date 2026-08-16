# DIN COUTURE — Company discovery

**Run:** NEXT COMPANY UNIFIED LEDGER CONTROLLED ROLLOUT  
**Date:** 2026-06-27  
**Method:** Read-only production SQL

---

## Target company

| Field | Value |
|-------|-------|
| Name | **DIN COUTURE** |
| Company id | `2ab65903-62a3-4bcf-bced-076b681e9b74` |
| Active | Yes |

No ambiguous duplicate COUTURE records — single match.

---

## Branches

| Branch id | Name |
|-----------|------|
| `df93b9e4-feea-4b8b-8103-e630c185261b` | SHOP A13 |

---

## Golden party (candidate)

| Field | Value |
|-------|-------|
| Name | DHARIA |
| Contact id | `04831980-546b-4ff2-bc9d-2e75a43eb51c` |
| Account code | AR-CUS0010 |

---

## Unified ledger flags (pre-rollout)

| Check | Result |
|-------|--------|
| unified_ledger* rows for DIN COUTURE | **0** |
| Loader flags ON | **None** |

PASS — expected pre-stage state.

---

## QA user binding (credentials gate)

Read-only check of `QA_BROWSER_EMAIL` user on production:

| Email (masked) | Bound company | Role |
|----------------|---------------|------|
| ndm313@*** | **DIN BRIDAL** (`597a5292-…`) | admin |

**Not DIN COUTURE.** Rollout requires a DIN COUTURE ERP user for golden capture and monitoring.

---

## Other companies (unchanged)

| Company | Unified flags | Loaders |
|---------|---------------|---------|
| DIN CHINA | 12/12 ON | 5/5 ON |
| DIN BRIDAL | 12/12 ON | 5/5 ON |
| Other | 0 loaders | PASS |
