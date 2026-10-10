# Staging rehearsal report — worker/courier role model

**Date:** 2026-09-22  
**Branch:** `feat/worker-courier-role-model-implementation`  
**Starting SHA:** `dda0f0568f2bae8421731f47f612a78b18070ec6`  
**Strategy:** `STRATEGY_A_PROSPECTIVE_FIRST`  
**Verdict:** `PROSPECTIVE_ROLE_MODEL_STAGING_PASS`

## Isolation

| Check | Result |
|------|--------|
| Clone DB | `ledger_stage_20260922_prodcheck` (249 MB) |
| `current_database() <> postgres` | PASS |
| Source | `pg_dump` of live `postgres` (read-only dump → separate DB) |
| App HTTP | loopback `127.0.0.1:18082` (REST) / `:18083` (Auth) — **not** `*.dincouture.pk` |
| JWT secret | staging-generated under `/root/role-model-stage/` (not prod keys) |
| Marker | **`ROLE_MODEL_STAGING_ISOLATION_PROVEN`** |

Company A (DIN): `e08a04af-22a8-4869-9b4d-da31fce13158`  
Company B (control): `2ab65903-62a3-4bcf-bced-076b681e9b74`

Graphify stash (by message, not index): `On main: graphify root` — **not popped/dropped/committed**.

## External side effects

**`STAGING_EXTERNAL_SIDE_EFFECTS_DISABLED`** — loopback GoTrue+PostgREST only; SMTP to localhost:1025; no prod n8n/WhatsApp/payment gateway wiring; stack torn down after rehearsal; clone retained.

## STAGING_T0

`2026-09-22 01:09:22.962218+00` (Asia/Karachi session stamp during run).  
Pre-T0 AP history frozen; post-T0 activity tagged `STAGING_REHEARSAL*`.

## Migration on clone

| Item | Result |
|------|--------|
| `20260922120000_worker_courier_role_model_account_domain.sql` | Applied + re-applied (idempotent) |
| Enum fix | `COALESCE(type::text,'')` (staging defect found/fixed) |
| `20260922130000_record_payment_worker_role_leaf_debit.sql` | Applied — wires worker debit to WA/WP leaves |
| Marker | **`ROLE_MODEL_STAGING_POSTGRES_PASS`** |

## Type flips (clone only)

| Code | Before | After | Leaves |
|------|--------|-------|--------|
| SUP-ZHD-0007 DHL local | supplier | courier | `203164` |
| SUP-ZHD-0036 KIRAN | supplier | worker | `WA-SUPZHD0036`, `WP-SUPZHD0036` |
| SUP-ZHD-0046 SHAHMIM | supplier | worker | `WA-SUPZHD0046`, `WP-SUPZHD0046` |
| SUP-ZHD-0162 DHL PK | supplier | **unchanged** | existing `2030162` distinct |

**`STAGING_ROLE_LEAF_CREATION_PASS`**

## Lifecycles

| Case | Marker |
|------|--------|
| KIRAN WA→bill→apply→pay | `KIRAN_STAGING_WORKER_LIFECYCLE_PASS` |
| SHAHMIM independent | `SHAHMIM_STAGING_WORKER_LIFECYCLE_PASS` |
| DHL deposit/charge/settle | `DHL_STAGING_COURIER_LIFECYCLE_PASS` |
| Ordinary supplier | `ORDINARY_SUPPLIER_REGRESSION_PASS` |
| Historical AP freeze (202 lines, fp `e2d8dbaf…`) | `STRATEGY_A_HISTORICAL_FREEZE_PASS` |
| JWT same/cross/anon | `STAGING_JWT_COMPANY_ISOLATION_PASS` |
| `record_payment_with_accounting` → WA leaf | `RPC_WORKER_PAYMENT_LEAF_OK` (KIRAN Dr 77 to `WA-SUPZHD0036`) |

Browser UI smoke: **`BROWSER_UI_ROLE_SMOKE_UNAVAILABLE`** (API/PostgREST + SQL JE paths proven).

## Defects found & fixed on branch

1. **PAYMENT_ROUTING_BLOCKER** — `record_payment_with_accounting` debited bare `1180` → wired to `_resolve_worker_payment_debit_account`.  
2. **Enum COALESCE** — `COALESCE(contact_type, '')` invalid on real PG enum → cast `::text`.

## Production

READ-ONLY precheck: types still supplier; 0 target role leaves; role-model assert **absent** on live `postgres`.  
No production migration/deploy/type flip.

## GHA

**`GITHUB_ACTIONS_UNVERIFIED`** — OAuth token still lacks `workflow` scope.
