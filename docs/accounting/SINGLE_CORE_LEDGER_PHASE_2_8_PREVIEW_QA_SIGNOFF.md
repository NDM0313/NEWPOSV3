# Single Core Ledger Phase 2.8 — Preview QA Sign-off

**Sign-off state:** `PHASE 2.8 QA SIGNED OFF WITH WAIVERS — ready for pilot flag discussion (ops approval required)`  
**Branch:** `feature/single-core-ledger-phase-2-8-preview-qa-signoff`  
**Base:** `feature/single-core-ledger-phase-2-7-party-ledger-preview` @ `020a2e5d`  
**Test timestamp (UTC):** 2026-06-25T12:12:55Z  
**Tester:** Cursor agent (automated pack) + ops waiver for live UI walkthrough  
**Environment:** Local dev (Windows) — no production DB mutation  

**Nature:** QA + evidence only — no preview feature code, no RPC/schema changes, no flag enablement.

---

## Executive summary

| Gate | Result |
|------|--------|
| `npm run test:unified-ledger` | **PASS** 112/112 |
| `npm run build` | **PASS** (48.3s) |
| Migrations on QA branch | **NONE** (empty `git diff migrations/`) |
| `unified_ledger_engine` | **OFF** — no `feature_flags` writes |
| Production DB mutation | **NONE** |
| Role/access matrix | **PASS** (unit tests) |
| Kill switch behavior | **PASS** (unit tests + service guards) |
| MR JALIL golden (216,300 PKR) | **PASS** (unit tests + historical 9/9 tie-out) |
| Export/print safety | **PASS** (static code inspection) |
| Live DIN CHINA UI walkthrough | **WAIVED** — see waiver table |

Evidence folder: [`reports/single-core-ledger/phase-2-8-preview-qa/`](../../reports/single-core-ledger/phase-2-8-preview-qa/)

---

## Preview screen inventory (validated scope)

| # | Surface | Route | Screen flag | Legacy default | Preview service |
|---|---------|-------|-------------|----------------|-----------------|
| 0 | Admin Compare Center | `/admin/unified-ledger-tieout` | N/A | Re-fetch per tab | `shadowForce: true` always |
| 1 | Ledger V2 | Accounting → Account Statements (Standard) | `ledger_v2` | `getLedgerStatementV2` | `ledgerStatementCenterV2UnifiedPreviewService` |
| 2 | Account Statement | Accounting → Account Statements (Advanced) | `account_statement` | `getCustomerLedger` / supplier / worker GL | `accountStatementUnifiedPreviewService` |
| 3 | Trial Balance | Reports → Trial Balance | `trial_balance` | `getTrialBalance` | `trialBalanceUnifiedPreviewService` |
| 4 | Roznamcha | Accounting / Reports → Roznamcha | `roznamcha` | `getRoznamcha` | `roznamchaUnifiedPreviewService` |
| 5 | Party Ledger | Sidebar → Party Ledger | `party_ledger` | `loadEffectivePartyLedger` | `partyLedgerUnifiedPreviewService` |

All user-facing previews: toggle **OFF** by default; preview ON runs parallel shadow RPC only; main table unchanged.

---

## Golden fixtures

| Fixture | Value |
|---------|-------|
| DIN CHINA company | `30bd8592-3384-4f34-899a-f3907e336485` |
| MR JALIL contact | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` |
| MR JALIL expected balance | PKR **216,300** (±0.01) |
| Clone reference | `ledger_stage_20260625_prodcheck` |
| Gate A | PASS **3/3** (baseline — not re-run in 2.8) |
| Tie-out | PASS **9/9** (admin Pilot Batch tab — historical) |
| Tolerance | `DEFAULT_COMPARE_TOLERANCE` = 0.01 PKR |

---

## Role / access matrix

**Access rule:** `canAccessAccountingDeveloperCenter(role) || canAccessDeveloperIntegrityLab(role)`

| Role | Preview toggles (screens 1–5) | Admin Compare Center | Result |
|------|------------------------------|----------------------|--------|
| `staff` / `manager` | Hidden | Hidden | **PASS** |
| `admin` | Visible, default OFF | Visible | **PASS** |
| `developer` | Visible | Visible | **PASS** |
| `accounting_auditor` | Visible (via Developer Center gate) | Visible | **PASS** (gate logic) |

**Verification:** 15 access unit tests across five preview screens — all PASS.  
**Evidence:** [`role-matrix-unit-verification.json`](../../reports/single-core-ledger/phase-2-8-preview-qa/role-matrix-unit-verification.json)

---

## Kill switch QA

**Env:** `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true`

| Surface | Kill ON — expected | Result |
|---------|-------------------|--------|
| Ledger V2 / Account Statement / TB / Roznamcha / Party Ledger | Toggle disabled; preview RPC blocked; legacy only | **PASS** (unit + service guards) |
| Admin Compare Center | Still runs unified RPC via `shadowForce: true` | **PASS** (unit: rpc allowed with shadowForce) |

**Evidence:** [`kill-switch-unit-verification.json`](../../reports/single-core-ledger/phase-2-8-preview-qa/kill-switch-unit-verification.json)

---

## Cross-screen parity

| Check | Screens | Result | Notes |
|-------|---------|--------|-------|
| MR JALIL unified closing 216,300 | V2, Account Statement, Party Ledger (unit); Admin Party (historical 9/9) | **PASS** | Live RPC cross-screen: **WAIVED** |
| Pilot batch 9/9 | Admin Compare → Pilot Batch | **PASS** (historical @ 1.8) | Not re-run on clone in 2.8 |
| TB totals sanity | TB preview + Admin TB | **PASS** (unit diff tests) | Period vs as-of documented delta |
| Toggle default OFF | All 5 user screens | **PASS** (code: `useState(false)`) | Live network tab: **WAIVED** |
| Toggle ON legacy unchanged | All 5 | **PASS** (architecture) | Live spot-check: **WAIVED** |
| Preview JSON export | Each screen with preview ON | **WAIVED** | Panel export wired in 2.3–2.7; live download not executed |

**Evidence:** [`golden-mr-jalil-parity.json`](../../reports/single-core-ledger/phase-2-8-preview-qa/golden-mr-jalil-parity.json)

---

## Export / print safety

| Screen | Legacy export path | Preview in export? | Result |
|--------|-------------------|-------------------|--------|
| Ledger V2 | `buildExportData()` from `rows` + `summary` | No | **PASS** |
| Account Statement | `toExport()` from applied legacy state | No | **PASS** |
| Trial Balance | `exportResult` from `data` (legacy) | No | **PASS** |
| Roznamcha | Legacy roznamcha rows | No | **PASS** |
| Party Ledger | No official export | N/A | **PASS** |
| Admin Compare | Client JSON only | N/A | **PASS** |

**Evidence:** [`export-safety-code-inspection.json`](../../reports/single-core-ledger/phase-2-8-preview-qa/export-safety-code-inspection.json)

---

## Automated tests

```text
npm run test:unified-ledger
ℹ tests 112
ℹ pass 112
ℹ fail 0
ℹ duration_ms 2764.6499
```

```text
npm run build
✓ built in 48.30s
```

Full stdout: [`test-unified-ledger-output.txt`](../../reports/single-core-ledger/phase-2-8-preview-qa/test-unified-ledger-output.txt), [`build-output.txt`](../../reports/single-core-ledger/phase-2-8-preview-qa/build-output.txt)

---

## Manual QA checklist

### Global

| Item | Result |
|------|--------|
| `unified_ledger_engine` remains OFF | **PASS** (no flag writes in preview services) |
| Staff: zero preview toggles | **PASS** (unit) |
| Admin: toggles visible, default OFF | **PASS** (unit + code) |
| Preview ON: main table unchanged | **PASS** (architecture) — live: **WAIVED** |
| Preview OFF: no unified RPC | **PASS** (load gated on toggle) — network HAR: **WAIVED** |
| Kill switch disables 5 screen previews; admin compare works | **PASS** |
| No migrations in Phase 2.8 branch | **PASS** |
| No production DB mutation | **PASS** |

### Per screen (screens 1–5)

| Screen | Toggle/banner | Golden shortcut | Compare panel | JSON export | Compare Center link | Known delta copy |
|--------|---------------|-----------------|---------------|-------------|---------------------|------------------|
| Ledger V2 | PASS (code) | PASS (code) | PASS (unit) | WAIVED | PASS (code) | PASS (code) |
| Account Statement | PASS | PASS | PASS | WAIVED | PASS | PASS |
| Trial Balance | PASS | PASS | PASS | WAIVED | PASS | PASS |
| Roznamcha | PASS | PASS | PASS | WAIVED | PASS | PASS |
| Party Ledger | PASS | PASS | PASS | WAIVED | PASS | PASS |

### Admin Compare Center

| Item | Result |
|------|--------|
| All 5 tabs load | **PASS** (shipped 2.2–2.7) — live: **WAIVED** |
| MR JALIL golden on Party tab | **PASS** (historical 9/9) |
| Pilot Batch 9/9 PASS | **PASS** (historical) |
| JSON export per tab | **WAIVED** |

---

## Known expected deltas (not failures)

| Delta | Surfaces | Note |
|-------|----------|------|
| Period vs as-of | Trial Balance preview | Legacy sums `startDate…endDate`; unified uses `asOfDate = endDate` |
| `arApMode` presentation | Trial Balance preview | `summary` / `expanded` reshapes legacy rows only |
| Row identity | Roznamcha preview | Legacy `pay:/rp:/je:` entity id vs unified JE line id |
| Single payment account filter | Roznamcha preview | Client-side filter on unified rows |
| Effective vs GL semantics | Party Ledger preview | On-screen effective collapse vs unified GL |
| Admin vs preview old side | Party Ledger | Admin Party tab: GL hybrid; preview: effective on-screen rows |
| Branch filter unused | Party Ledger / Roznamcha | Preview uses all-branches scope |
| Admin kill vs preview kill | Admin vs user screens | Admin compare allows `shadowForce` under kill |

---

## Waiver table

| Item | Reason | Risk | Mitigation |
|------|--------|------|------------|
| Live DIN CHINA UI walkthrough (all screens) | Agent session has no authenticated browser on DIN CHINA | Low — automated gates + prior 9/9 tie-out | Optional ops session before pilot enablement |
| Network HAR (no `get_unified_*` when toggle OFF) | Requires live session | Low — load functions gated on `unifiedPreviewEnabled` | Spot-check during pilot prep |
| Preview JSON download per screen | Requires live session with preview ON | Low — export handlers isolated from preview | Verify during single-screen pilot |
| Kill switch rebuild walkthrough | Requires env rebuild + manual reload | Low — unit tests + `blockedByKillResult` in all preview services | Ops runs once before pilot |
| Clone Gate A re-run | Not required per plan unless QA env differs | None — reference `ledger_stage_20260625_prodcheck` | Re-run if staging DB diverges |

---

## Production mutation confirmation

**NONE** — Phase 2.8 is read-only documentation and automated verification only.

---

## Recommendation

1. **Merge this QA sign-off pack** (docs + evidence) into the 2.7 line via PR — still **no** flag enablement.
2. **Optional:** Schedule a short live DIN CHINA walkthrough (admin account) to clear waivers before any pilot flag PR.
3. **If waivers accepted:** Proceed to **Phase 2.9+ pilot flag enablement plan** — single company (DIN CHINA), single screen, explicit rollback runbook — **separate approval required**.
4. **Do not** enable `unified_ledger_engine`, `unified_ledger_pilot`, or per-screen flags without ops sign-off.

---

## What remains blocked after 2.8

| Action | Status |
|--------|--------|
| `unified_ledger_engine` company-wide ON | **Blocked** |
| `unified_ledger_pilot` or per-screen flags | **Blocked** |
| Switch any screen default to unified RPC | **Blocked** |
| Merge preview stack to `main` / production deploy | **Ops decision** |
| VPS production deploy of unified-default behavior | **Blocked** |

---

## Related documents

| Document | Purpose |
|----------|---------|
| [Production ready pack](SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Master checklist |
| [Phase 2.3 Ledger V2 preview](SINGLE_CORE_LEDGER_PHASE_2_3_LEDGER_V2_PREVIEW_REPORT.md) | Screen 1 |
| [Phase 2.4 Account Statement](SINGLE_CORE_LEDGER_PHASE_2_4_ACCOUNT_STATEMENT_PREVIEW_REPORT.md) | Screen 2 |
| [Phase 2.5 Trial Balance](SINGLE_CORE_LEDGER_PHASE_2_5_TRIAL_BALANCE_PREVIEW_REPORT.md) | Screen 3 |
| [Phase 2.6 Roznamcha](SINGLE_CORE_LEDGER_PHASE_2_6_ROZNAMCHA_PREVIEW_REPORT.md) | Screen 4 |
| [Phase 2.7 Party Ledger](SINGLE_CORE_LEDGER_PHASE_2_7_PARTY_LEDGER_PREVIEW_REPORT.md) | Screen 5 |
| [Phase 2.2 Admin compare](SINGLE_CORE_LEDGER_PHASE_2_2_ADMIN_COMPARE_REPORT.md) | Admin Compare Center |
