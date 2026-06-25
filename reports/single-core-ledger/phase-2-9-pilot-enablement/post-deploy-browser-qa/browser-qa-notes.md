# Phase 2.9A-6 — Ledger V2 Stage 1 Gate Confirmation

**Sign-off:** `PHASE 2.9A STILL BLOCKED — Party/Pilot/Ledger V2 gate not passed`  
**Timestamp (UTC):** 2026-06-25T16:45:00Z  
**Mode:** OPS GATE CONFIRMATION ONLY — no flags, no Stage 1/2 SQL, no DB writes  
**Branch / docs:** `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` @ `cb4957c7`  
**Preview:** `erp-frontend-preview` VPS `:3003`, tunnel `localhost:3002 → 127.0.0.1:3003`  
**Evidence JSON:** [`phase-2.9a-6-gate-confirmation.json`](phase-2.9a-6-gate-confirmation.json)

---

## Stage 1 flag correction (must match §7 before any SQL execution)

| Stage | Enable | Do **not** enable |
|-------|--------|-------------------|
| **Stage 1** | `unified_ledger_pilot` only | `unified_ledger_engine`, `unified_ledger_screen_ledger_v2`, Roznamcha/CashBank/any other screen flag |
| **Stage 2** | `unified_ledger_engine` + `unified_ledger_screen_ledger_v2` | Other companies, other screens |

Prior doc wording “Stage 1 Ledger V2 flag only” was **incorrect** — aligned to pilot plan §7.

---

## Gate results

### Gate 1 — Party / MR JALIL (Admin Compare)

| Field | Value |
|-------|-------|
| Required | PASS on preview browser |
| Basis | `effective_party` |
| Branch | DIN CHINA / BL0002 |
| Contact | MR JALIL |
| Date scope | Empty From = lifetime |
| Expected | PKR 216,300.00 both sides |
| **Result** | **OPEN** — operator browser session required |

**Read-only support:** `get_unified_party_ledger` (effective_party) closing **216,300.00** PASS — [`phase-29a6-gate-mr-jalil.sql`](../../../scripts/single-core-ledger/phase-29a6-gate-mr-jalil.sql)

### Gate 2 — Pilot Batch 9/9

| Field | Value |
|-------|-------|
| Required | 9 compared, 9 PASS |
| **Result** | **OPEN** — run Pilot Batch tab on fixed preview (`312716e7+`) |

### Gate 3 — Ledger V2 browser QA

| # | Check | Result | Notes |
|---|-------|--------|-------|
| — | Preview container Up | **PASS** | `erp-frontend-preview` :3003 |
| — | Tunnel localhost:3002 | **PASS** | HTTP 200 |
| — | MR JALIL RPC 216,300 | **PASS** | Read-only; not live UI |
| 1 | Admin login | **OPEN** | `QA_BROWSER_PASSWORD` not set |
| 2 | DIN CHINA context | **OPEN** | |
| 3 | Ledger V2 opens | **OPEN** | |
| 4 | Preview toggle visible | **OPEN** | |
| 5 | Toggle default OFF | **OPEN** | |
| 6 | Banner legacy | **OPEN** | |
| 7 | No unified RPC toggle OFF | **OPEN** | |
| 8 | Toggle ON + MR JALIL | **OPEN** | |
| 9 | Closing 216,300 UI | **OPEN** | RPC PASS only |
| 10 | Preview JSON export | **OPEN** | |
| 11 | PDF/Excel legacy | **OPEN** | |
| 12 | Admin Compare loads | **OPEN** | Route in bundle |
| 13 | Staff visibility | **WAIVED** | No DIN CHINA staff user |

**Automation:** `node scripts/single-core-ledger/run-phase-29a4-browser-qa.mjs` (requires `QA_BROWSER_PASSWORD`)

### Gate 4 — Flags read-only

| Field | Value |
|-------|-------|
| SQL | [`phase-29a6-gate-flags.sql`](../../../scripts/single-core-ledger/phase-29a6-gate-flags.sql) |
| Rows | 0 |
| **Result** | **PASS** |

---

## Cash/Bank (excluded from Stage 1 gate)

**Waiver:** Cash/Bank Admin Compare is **not** a Stage 1 blocker. Remediation → Phase 2.9A-CB. Do not enable Roznamcha/CashBank flags.

---

## Verification (no ops mutations)

| Check | Result |
|-------|--------|
| `npm run test:unified-ledger` | **136/136 PASS** |
| `npm run build` | **PASS** |
| Migrations | NOT RUN |
| Stage 1 / Stage 2 SQL | NOT RUN |
| Feature flag writes | NONE |
| Production ERP | UNCHANGED |

---

## Operator completion

```powershell
$env:QA_BROWSER_PASSWORD = '<admin password>'
node scripts/single-core-ledger/run-phase-29a4-browser-qa.mjs
```

Then on Admin Compare (`/admin/unified-ledger-tieout`):

1. Party — MR JALIL → PASS  
2. Pilot Batch → 9/9 PASS  
3. Re-sign evidence → status **A** → Stage 1 ops ticket (`unified_ledger_pilot` only)
