# Single Core Ledger Phase 2.9 — DIN CHINA Single-Screen Pilot Flag Enablement Plan

**Status:** `PHASE 2.9A LIVE WAIVER CHECKS PASS WITH LIMITED WAIVERS — review before Stage 1`  
**Mode:** PLAN + OPS CHECK — no `feature_flags` writes, no deploy, no merge  
**Branch:** `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` @ `fe1b9c15`  
**Base:** `feature/single-core-ledger-phase-2-8-preview-qa-signoff` @ `807fdbcd`  
**Last updated:** 2026-06-25  

**Prerequisite:** Phase 2.8 complete — 112/112 `test:unified-ledger`, build PASS, signed off with waivers. See [`SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md`](SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md).

---

## Pilot screen recommendation

**Selected: Option A — Ledger Statement V2** (`ledger_v2` / `unified_ledger_screen_ledger_v2`).

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **A — Ledger V2** | **Selected** | First preview shipped (2.3); MR JALIL shortcut; 112-test coverage; export safety verified in 2.8; single statement-type model vs Account Statement's customer/supplier/worker matrix |
| B — Account Statement | Defer | Higher QA surface (multiple GL loaders); same flag risk but more parity paths to watch |
| C — Admin Compare only | Reject as pilot | Already runs unified RPC via `shadowForce: true` without flags ([`unifiedLedgerEngineState.ts`](../../src/app/lib/unifiedLedgerEngineState.ts) `adminTieOut`); flag enablement does not exercise user-screen rollout |

**Critical code reality (limits blast radius today):** [`resolveUnifiedLedgerEngineState`](../../src/app/lib/unifiedLedgerEngineState.ts) can return `mode: 'unified'` when `unified_ledger_engine` + per-screen flag are ON, but **no screen swaps the main table loader** based on `engineState.mode`. Preview RPC on Ledger V2 only runs when the manual preview toggle is ON ([`LedgerStatementCenterV2Page.tsx`](../../src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx)). Phase 2.9 flag enablement therefore changes **banners/badges and resolver state only** — not default data source.

```mermaid
flowchart TD
  subgraph today [Current behavior after flags ON]
    flags[engine_ON + screen_ledger_v2_ON] --> banner[Banner mode unified]
    flags --> legacyMain[Main table still getLedgerStatementV2]
    toggle[Preview toggle manual ON] --> shadowRPC[Parallel shadow RPC]
    legacyMain --> table[User sees legacy rows]
  end
```

---

## 1. Branch strategy

| Item | Value |
|------|-------|
| **Plan branch** | `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` |
| **Base** | `feature/single-core-ledger-phase-2-8-preview-qa-signoff` @ `807fdbcd` |
| **PR title** | `Single Core Ledger Phase 2.9 — DIN CHINA Pilot Enablement Plan` |
| **PR base** | `feature/single-core-ledger-phase-2-8-preview-qa-signoff` |
| **Nature** | Plan doc + rollback SQL templates + checklists only — **no flag writes in PR** |

**Evidence folder (execution phase):** [`reports/single-core-ledger/phase-2-9-pilot-enablement/`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/)

---

## 2. Pilot objective

Validate **production flag read paths** for DIN CHINA on **one screen** (Ledger V2) under **admin/developer-only** preview access, with **instant rollback** and **no loader default switch**, before any multi-screen or multi-company rollout.

Success = flags readable, banners correct, legacy table + exports unchanged, MR JALIL unified closing still **216,300** when preview toggle ON, staff unaffected.

---

## 3. Pilot scope

| Dimension | In scope | Out of scope |
|-----------|----------|--------------|
| Company | DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485` | All other companies |
| Screen | Ledger V2 only | Account Statement, TB, Roznamcha, Party Ledger |
| Users | `admin`, `developer`, `accounting_auditor` (preview gate) | `staff` / `manager` (must see zero preview UI) |
| Behavior | Flag-driven banner/mode; manual preview toggle unchanged | Replace `getLedgerStatementV2` as default loader |
| Data | `feature_flags` upsert for DIN CHINA only (after separate ops approval) | GL amounts, journal lines, migrations |

---

## 4. Preconditions

- [ ] Phase 2.8 sign-off merged or referenced @ `807fdbcd`
- [ ] `npm run test:unified-ledger` — 112/112 PASS at execution commit
- [ ] `unified_ledger_engine` **OFF** for DIN CHINA before any step (verify via SQL or Settings UI)
- [ ] No open P0 on Ledger V2 preview from 2.8 waiver review
- [ ] Ops assigns **flag executor** + **rollback approver** (two-person rule recommended)
- [ ] DIN CHINA admin test account available for live walkthrough
- [ ] Backup reference documented: `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` (not required for flag-only rollback)

**Pre-flag SQL read (read-only):**

```sql
SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;
```

Expect: no rows or all `enabled = false`.

---

## 5. Waiver handling (from Phase 2.8)

Clear these **before** any flag enablement (live session on DIN CHINA):

| 2.8 waiver | 2.9 clearance action |
|------------|---------------------|
| Live DIN CHINA walkthrough | Admin walks all 6 surfaces; record pass/fail in 2.9 evidence |
| Network HAR (no `get_unified_*` when toggle OFF) | DevTools filter on Ledger V2 with flags OFF and ON (toggle OFF) |
| Preview JSON download | Download `phase2-compare-*.json` from Ledger V2 panel |
| Kill-switch rebuild | Set `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true`, rebuild, confirm toggle disabled |

Until waivers cleared: **do not execute flag steps**.

### Phase 2.9A-2 browser waiver closure (2026-06-25T12:55:00Z)

**Report:** [`browser-waiver-closure/browser-waiver-closure.md`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/browser-waiver-closure/browser-waiver-closure.md)

| Finding | Result |
|---------|--------|
| Production ERP preview UI deployed | **NO** — Ledger V2 preview strings missing from `erp.dincouture.pk` bundle |
| Admin Compare route in bundle | **YES** (`unified-ledger-tieout`) |
| Authenticated browser session | **NOT RUN** |
| Live checks 1–11 on production | **BLOCKED** until preview deploy |

---

### Phase 2.9A ops check results (2026-06-25T12:47:00Z)

**Report:** [`reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/live-waiver-checks.md`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/live-waiver-checks.md)

| 2.8 waiver | 2.9A status |
|------------|-------------|
| Live DIN CHINA walkthrough | **Open** — browser session required |
| Network HAR (toggle OFF) | **Open** |
| Preview JSON download | **Open** |
| Kill-switch rebuild | **Open** (DB kill flag absent; env rebuild not run) |

**Completed without mutation:**

| Check | Result |
|-------|--------|
| DIN CHINA `feature_flags` all `unified_ledger%` OFF | **PASS** (0 rows) |
| MR JALIL unified closing via read-only RPC | **PASS** — PKR **216,300.00** |
| `npm run test:unified-ledger` | **PASS** 112/112 |
| Stage 1 / Stage 2 SQL | **NOT RUN** |

---

## 6. Feature flags required

Keys from [`unifiedLedgerFlagKeys.ts`](../../src/app/lib/unifiedLedgerFlagKeys.ts) / [`featureFlagsService.ts`](../../src/app/services/featureFlagsService.ts):

| Flag key | Scope | Default | Role in pilot |
|----------|-------|---------|---------------|
| `unified_ledger_pilot` | Company (DIN CHINA) | OFF | Shows pilot badge in preview panel; does **not** enable unified mode alone |
| `unified_ledger_engine` | Company (DIN CHINA) | OFF | Master gate; required for `mode: unified` |
| `unified_ledger_screen_ledger_v2` | Company (DIN CHINA) | OFF | Per-screen gate for Ledger V2 only |
| `unified_ledger_kill_switch` | Company (DIN CHINA) | OFF | DB emergency stop (company-scoped in resolver) |
| `VITE_UNIFIED_LEDGER_ENGINE_KILLED` | Build/env | unset | Global env kill (no DB); requires redeploy to activate |

**Resolver rules** ([`unifiedLedgerEngineState.ts`](../../src/app/lib/unifiedLedgerEngineState.ts)):

- **Kill switch** (env or DB): `mode → killed`; user preview RPC blocked; admin compare still allows `shadowForce`
- **Preview toggle ON**: `mode → preview` (overrides unified banner while comparing)
- **Engine OFF**: `mode → legacy` even if per-screen flag ON
- **Engine ON + screen OFF**: `mode → legacy` (screen gate)
- **Engine ON + screen ON + toggle OFF**: `mode → unified` (banner only today)
- **`rpcAllowed`**: `true` when engine ON (or `shadowForce`); user screens still gate RPC on **manual preview toggle**, not `rpcAllowed` alone

**`unified_ledger_pilot` is informational** in preview panels — recommended as **Stage 1** to validate DB write before engine enablement.

---

## 7. Exact flag enablement proposal (DO NOT RUN UNTIL OPS APPROVAL)

**Staged enablement — DIN CHINA only — separate ops approval per stage.**

### Stage 0 — Baseline capture

Record `feature_flags` snapshot + screenshot of Ledger V2 banner (`data-unified-ledger-mode="legacy"`).

### Stage 1 — Pilot flag only (lowest risk)

```sql
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_pilot',
  true,
  'Phase 2.9 DIN CHINA pilot — preview badge only'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, updated_at = now();
```

**Expected:** Pilot badge visible in Ledger V2 preview panel when toggle ON; main table unchanged; `mode` still `legacy` with toggle OFF.

**Soak:** 24h — staff spot-check (no toggles), admin confirms no regressions.

### Stage 2 — Engine + single screen flag (pilot target)

Only after Stage 1 PASS + live QA §9–10:

```sql
-- Step 2a: company engine ON
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_engine',
  true,
  'Phase 2.9 DIN CHINA pilot — company engine (Ledger V2 screen gate still required)'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, updated_at = now();

-- Step 2b: Ledger V2 screen only (no other unified_ledger_screen_* keys)
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_screen_ledger_v2',
  true,
  'Phase 2.9 DIN CHINA pilot — Ledger V2 screen gate'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, updated_at = now();
```

**Expected:** Banner `data-unified-ledger-mode="unified"` on Ledger V2 when preview toggle OFF; legacy table + exports unchanged; preview toggle still required for parallel RPC.

**Explicitly do NOT enable:** `unified_ledger_screen_account_statement`, `trial_balance`, `roznamcha`, `party_ledger` for any company.

### Stage 3 — Not in 2.9

Default loader swap (replace `getLedgerStatementV2`) → future Phase 2.10+ with separate plan and ops approval.

---

## 8. Rollback runbook

**Order: fastest user impact first. No DB restore required for flag rollback.**

### Level 1 — Per-screen flag OFF (targeted)

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_screen_ledger_v2';
```

### Level 2 — Pilot flag OFF

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_pilot';
```

### Level 3 — Company engine OFF

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_engine';
```

### Level 4 — DB kill switch ON (company emergency)

```sql
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_kill_switch',
  true,
  'Emergency — force legacy unified paths'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, updated_at = now();
```

### Level 5 — Env kill (global, requires redeploy)

Set `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true` in production env → rebuild/redeploy web bundle.

### Post-rollback verification

- [ ] Ledger V2 banner `data-unified-ledger-mode="legacy"` or `killed`
- [ ] Main statement table matches pre-pilot export spot-check
- [ ] PDF/Excel/CSV export totals unchanged
- [ ] Staff user: no preview toggles on any screen
- [ ] `/admin/unified-ledger-tieout` Party tab still loads (under kill: compare still works via `shadowForce`)
- [ ] Re-run `SELECT ... unified_ledger%` — confirm intended OFF states

---

## 9. Live QA checklist — before enablement

Run on **DIN CHINA** as **admin/developer** (clears 2.8 waivers):

- [x] All flags OFF — confirm SQL baseline (**PASS** 2026-06-25 — [`pre-flag-flags.json`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/pre-flag-flags.json))
- [ ] Ledger V2: toggle visible, default OFF; banner legacy (**WAIVED** — live browser)
- [ ] Network: no `get_unified_party_ledger` / `get_unified_account_ledger` with toggle OFF (**WAIVED** — HAR)
- [x] Enable preview toggle → MR JALIL → unified closing **216,300** (±0.01) (**PASS** read-only RPC — [`mr-jalil-rpc-verification.json`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/mr-jalil-rpc-verification.json))
- [ ] Preview JSON export downloads; labeled non-official (**WAIVED**)
- [ ] Export PDF/Excel with preview ON matches preview OFF totals (**WAIVED**)
- [ ] Kill env test OR document DB kill switch dry-run on staging (**PARTIAL** — kill flag absent)
- [ ] Staff account: zero preview toggles on all 5 screens (**WAIVED**)
- [x] Record evidence under `reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/` (**DONE**)

---

## 10. Live QA checklist — after enablement

Repeat after **each stage** (1 and 2):

| Check | Stage 1 (pilot ON) | Stage 2 (engine + screen ON) |
|-------|-------------------|------------------------------|
| Banner mode on Ledger V2 (toggle OFF) | `legacy` | `unified` |
| Main table data vs pre-flag export | Identical | Identical |
| Preview toggle still manual | Yes | Yes |
| MR JALIL unified closing with toggle ON | 216,300 | 216,300 |
| Staff sees no toggles | Yes | Yes |
| Other companies unaffected | Yes | Yes |
| Other screens' flags still OFF | Yes | Yes |
| Admin Compare Pilot Batch 9/9 | PASS (regression) | PASS |

**Soak monitoring:** 24–72h with daily admin spot-check on MR JALIL + one non-golden party.

---

## 11. Monitoring plan

| Signal | Method | Alert threshold |
|--------|--------|-----------------|
| Flag state drift | Daily SQL read of `unified_ledger%` for DIN CHINA | Any unexpected key ON |
| User-reported statement mismatch | Support channel / ops Slack | Any report → Level 1 rollback |
| RPC errors | Browser console + Supabase logs for `get_unified_*` | Spike after flag enablement |
| Export complaints | Finance spot-check | Totals differ → rollback |
| Kill switch | Confirm OFF unless incident | ON without ticket → investigate |

No automated alerting required for 2.9 plan phase; ops manual checklist sufficient for single-company pilot.

---

## 12. User / role access plan

| Role | Ledger V2 during pilot |
|------|------------------------|
| `staff` / `manager` | Legacy only; **no preview toggle** (unchanged) |
| `admin` | Preview toggle visible; sees pilot/engine banners when flags ON |
| `developer` | Same as admin |
| `accounting_auditor` | Same (via Developer Center gate) |

**No role-based flag bypass** — flags are company-scoped; access to preview UI remains role-gated via [`ledgerV2UnifiedPreviewAccess.ts`](../../src/app/lib/ledgerV2UnifiedPreviewAccess.ts).

---

## 13. Success criteria

- [ ] Stage 1 + Stage 2 flag SQL executed only after ops approval and waiver clearance
- [ ] DIN CHINA only — no other `company_id` rows touched
- [ ] Only `unified_ledger_pilot`, `unified_ledger_engine`, `unified_ledger_screen_ledger_v2` enabled (plus kill switch only if testing rollback)
- [ ] Legacy main table + exports unchanged on Ledger V2
- [ ] MR JALIL unified closing **216,300** (±0.01) with preview toggle ON
- [ ] Staff unaffected on all screens
- [ ] Rollback drill completed once on staging or documented dry-run
- [ ] Evidence pack committed to `reports/single-core-ledger/phase-2-9-pilot-enablement/`

---

## 14. Failure criteria

Immediate rollback (Level 1–4) if any:

- Main Ledger V2 table totals differ from pre-flag baseline without preview toggle ON
- Export/print totals change vs pre-flag baseline
- Staff sees preview toggles
- MR JALIL unified closing outside ±0.01 with preview ON
- Unexpected `get_unified_*` calls with preview toggle OFF
- Flags enabled for wrong company or additional screens
- Finance or ops escalates statement trust issue

**Sign-off state on failure:** `PHASE 2.9 PILOT FAILED — flags reverted; do not expand rollout`

---

## 15. Evidence artifacts

| Artifact | Path |
|----------|------|
| Pre-flag `feature_flags` SQL output | [`pre-flag/pre-flag-flags.json`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/pre-flag-flags.json) |
| Phase 2.9A live waiver report | [`pre-flag/live-waiver-checks.md`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/live-waiver-checks.md) |
| MR JALIL RPC verification | [`pre-flag/mr-jalil-rpc-verification.json`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/mr-jalil-rpc-verification.json) |
| Post-stage SQL output | `post-stage-1-flags.json`, `post-stage-2-flags.json` |
| Ledger V2 screenshots (banner mode) | `ledger-v2-banner-legacy.png`, `ledger-v2-banner-unified.png` |
| MR JALIL compare JSON | `phase2-compare-ledger-v2-mr-jalil-*.json` |
| Network HAR snippet | `ledger-v2-no-unified-rpc-toggle-off.har` |
| Export spot-check notes | `export-parity-ledger-v2.md` |
| Rollback execution log | `rollback-drill-*.md` |

Golden fixtures:

| Fixture | Value |
|---------|-------|
| DIN CHINA company | `30bd8592-3384-4f34-899a-f3907e336485` |
| MR JALIL contact | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` |
| Expected balance | PKR **216,300** (±0.01) |

---

## 16. What remains blocked after 2.9

Even after successful pilot flags:

| Action | Status |
|--------|--------|
| Enable flags for DIN BRIDAL or other companies | Blocked |
| Enable additional per-screen flags | Blocked |
| Switch Ledger V2 default loader to unified RPC | Blocked (future phase) |
| `unified_ledger_engine` ON globally / all companies | Blocked |
| Merge preview stack to `main` / VPS deploy of new behavior | Ops decision |
| Remove legacy `getLedgerStatementV2` | Blocked |

---

## 17. Final status

**`PHASE 2.9A LIVE WAIVER CHECKS PASS WITH LIMITED WAIVERS — review before Stage 1`**

| Gate | Result |
|------|--------|
| Production flags OFF (DIN CHINA) | **PASS** |
| MR JALIL 216,300 (read-only RPC) | **PASS** |
| Preview UI on `erp.dincouture.pk` | **NOT DEPLOYED** |
| Live browser waiver clearance | **OPEN** — deploy preview build + ops session |
| Stage 1 SQL | **NOT RUN** |
| Stage 2 SQL | **NOT RUN** |

**Recommendation:** Run Phase 2.9A-3 parallel preview deploy → ops browser session on :3002 → re-sign **PASS** → Stage 1 ticket.

### Phase 2.9A-3 preview deploy plan (2026-06-25)

**Doc:** [`SINGLE_CORE_LEDGER_PHASE_2_9A3_PREVIEW_DEPLOY_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_9A3_PREVIEW_DEPLOY_PLAN.md)  
**Status:** `PHASE 2.9A-3 DEPLOY PLAN READY — waiting for ops approval to deploy preview-capable build`

| Item | Value |
|------|-------|
| Target | `erp-frontend-preview` port **3002** (SSH tunnel) |
| Production ERP | **Unchanged** |
| Flags | **OFF** — no DB writes in deploy |
| Script | [`deploy-phase-29a3-preview-frontend-vps.sh`](../../scripts/single-core-ledger/deploy-phase-29a3-preview-frontend-vps.sh) |

---

## Execution sequence (after plan approval)

1. Merge 2.9A-3 plan PR from `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan`
2. Ops approves parallel preview deploy → run `deploy-phase-29a3-preview-frontend-vps.sh`
3. Bundle verify + browser waiver on http://localhost:3002
4. Re-sign **PHASE 2.9A LIVE WAIVER CHECKS PASS**
5. Ops approves Stage 1 SQL → execute → §10 soak
6. Ops approves Stage 2 SQL → execute → §10 soak
7. **Stop before Stage 1 SQL without explicit ops ticket**
