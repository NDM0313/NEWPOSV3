# Production T0 execution report — worker/courier role model

**Verdict:** `ROLE_MODEL_PRODUCTION_T0_PASS`

## Authorization

| Item | Value |
|------|-------|
| Owner authorization | `APPROVE_ROLE_MODEL_PRODUCTION_T0` (auto-execute authorized) |
| `PRODUCTION_T0` | **2026-09-22 02:54:21 Asia/Karachi** |
| `PRODUCTION_T0` UTC | 2026-09-21 21:54:21 UTC |
| Cutover execution wall | 2026-09-22 02:56:32 Asia/Karachi |
| Company | DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158` |
| Product / capability SHA | `356819d0759948f1583c3b9f22e9dded4d9f2529` |
| Live build marker | `VITE_BUILD_COMMIT=0254b587` (docs-only forward; `src/`+`migrations/` diff vs product = **empty**) |
| Migrations rerun | **NO** |
| App redeployed during T0 | **NO** |

## Precheck (READ ONLY)

| Check | Result |
|-------|--------|
| erp-frontend | healthy |
| HTTPS `/` / `/health` | 200 / 200 |
| Capability migrations ×3 | present |
| Contacts | all `supplier` |
| Target role leaves | all 0 |
| DHL PK `2030162` | linked `4505905b-…` |
| hist AP fingerprint | `e2d8dbaf79042b661d354a95d1980d3e` |
| AP counts/nets | DHL 48 / 4.7M; KIRAN 68 / 2.25M; SHAHMIM 86 / 5.0M |
| GL imbalance | `0.00` |
| In-flight payments (2m) | 0 |

Precheck: **PASS** (no drift).

## Per-party results

### DHL local `SUP-ZHD-0007` / `6ce5bed0-bd0a-495d-8841-19f90be6188c`

| Field | Before | After |
|-------|--------|-------|
| type | supplier | **courier** |
| Role 203x | none | **`203163`** |
| Account UUID | — | `e45983a2-1a83-4a0a-b3a8-59eb17ac6852` |
| Parent | — | `2030` |
| contact_id | — | `6ce5bed0-…` |
| linked_contact_id | — | `6ce5bed0-…` |
| ≠ DHL PK | — | **YES** (`203163` ≠ `2030162`) |
| Idempotent re-ensure | — | same UUID |
| Role JE posts | — | **0** |

`DHL_PRODUCTION_T0_PASS`

### KIRAN `SUP-ZHD-0036` / `797ca8bb-5491-4827-8d6e-c7971d20a022`

| Field | Before | After |
|-------|--------|-------|
| type | supplier | **worker** |
| WA | none | **`WA-SUPZHD0036`** `a2d79596-14e4-46e2-9b51-23c73c9d9b18` parent **1180** asset |
| WP | none | **`WP-SUPZHD0036`** `575bbe2e-7c1c-4bd3-83d7-6c619dd34645` parent **2010** liability |
| linked_contact_id | — | KIRAN UUID on both |
| Idempotent re-ensure | — | same IDs |
| Role JE posts | — | **0** |

Resolver (read-only): advance → WA UUID; payable → WP UUID.

`KIRAN_PRODUCTION_T0_PASS`

### SHAHMIM `SUP-ZHD-0046` / `f902a1f8-cc8a-4508-8c47-beb1850da1ed`

| Field | Before | After |
|-------|--------|-------|
| type | supplier | **worker** |
| WA | none | **`WA-SUPZHD0046`** `70f84c46-abf8-449f-add9-70c0fa24d388` parent **1180** asset |
| WP | none | **`WP-SUPZHD0046`** `8277ed7c-9f31-4929-8e99-c4b32c336691` parent **2010** liability |
| linked_contact_id | — | SHAHMIM UUID on both |
| Idempotent re-ensure | — | same IDs |
| Role JE posts | — | **0** |

Historical ambiguous 344,000 opening credit: **not modified**.

`SHAHMIM_PRODUCTION_T0_PASS`

## Final role matrix

| Party | Type | Historical AP | WA | WP | 203x |
|-------|------|---------------|----|----|------|
| DHL local | courier | retained (AP-*) | — | — | `203163` |
| KIRAN | worker | retained (AP-*) | `WA-SUPZHD0036` | `WP-SUPZHD0036` | — |
| SHAHMIM | worker | retained (AP-*) | `WA-SUPZHD0046` | `WP-SUPZHD0046` | — |

Duplicate role leaf codes: **max count = 1** (no duplicates).

## Historical AP freeze

| Metric | Before | After |
|--------|--------|-------|
| fingerprint | `e2d8dbaf79042b661d354a95d1980d3e` | `e2d8dbaf79042b661d354a95d1980d3e` |
| DHL lines/net | 48 / 4,700,000 | identical |
| KIRAN lines/net | 68 / 2,250,000 | identical |
| SHAHMIM lines/net | 86 / 5,000,000 | identical |

`PRODUCTION_T0_HISTORICAL_AP_FREEZE_PASS`

## Accounting / closed scopes

| Check | Result |
|-------|--------|
| GL imbalance | `0.00` |
| Role leaf JE posts | 0 (structural only) |
| Cross-company leaf links | 0 |
| DHL PK `2030162` | unchanged |
| Ibrahim `AP-SUPZHD0026` | unchanged (273 lines) |
| ID LACE `210027` / `AP-SUPZHD0027` | 0 / 89 unchanged |
| Supplier dual-account cleanup | remains CLOSED |
| Strategy B | not executed |

## Visibility / routing (structural)

- Contact types no longer `supplier` → excluded from ordinary merchandise-supplier filters where role filters apply.
- Worker resolve: KIRAN/SHAHMIM advance→WA, payable→WP.
- Courier ensure: DHL → `203163`.
- Historical AP leaves retained as audit containers.
- Unified courier ledger: known PARTIAL usability (non-blocking).

## First genuine role transaction

`FIRST_GENUINE_ROLE_TRANSACTION_PENDING` for DHL, KIRAN, SHAHMIM  
(`AWAITING_FIRST_REAL_ROLE_POST`)

## Health / security

- Frontend healthy; `/` 200; `/health` 200
- Capability migrations present; not rerun
- Role/payment ACL contract unchanged (PUBLIC/anon deny)

## Graphify

`stash@{7}: On main: graphify root` — **UNTOUCHED**

## Explicit non-actions

- historical AP moved: **NO**
- Strategy B: **NO**
- supplier dual-account cleanup reopened: **NO**
- Ibrahim / ID LACE / DHL PK touched: **NO**
- Graphify stash touched: **NO**
- app redeployed during T0: **NO**
- migrations rerun during T0: **NO**
- dummy financial postings: **NO**
