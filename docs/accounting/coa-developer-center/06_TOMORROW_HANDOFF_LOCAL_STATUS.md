# Tomorrow handoff — Accounting Developer Center (local WIP)

**Saved:** 2026-06-03 (night)  
**WIP branch:** `wip/accounting-developer-center-local-handoff`  
**Source branch before handoff:** `feat/c2-roznamcha-trace` @ local uncommitted work  
**Do not merge to `main` or deploy to VPS without steps below.**

---

## 1. Current status

### Accounting Developer Center — local

Route: `/admin/accounting-developer-center`  
Access: `accountingDeveloperCenterAccess.ts` (admin, super-admin, developer, accounting_auditor)  
Facade: `accountingDeveloperCenterService.ts`  
Nav: Settings → Accounting & Finance → Developer Center; Sidebar link when role allows.

### Tabs — working locally (implemented)

| Tab | Slug | Status |
|-----|------|--------|
| COA Health | `coa` | **Working** — `CoaHealthTab.tsx`, `loadCoaHealthSnapshot` |
| Transaction Trace | `trace` | **Working** — `TransactionTraceTab.tsx`, `runTransactionTrace` |
| Roznamcha Trace | `roznamcha` | **Working** — `RoznamchaTraceTab.tsx`, dedupe diagnostics |
| Statement Trace | `statement` | **Working** — `StatementTraceTab.tsx`, party ledger + exclusion probes |
| Day Book | `daybook` | **Working** — `DayBookDiagnosticsTab.tsx`, unbalanced JE panel |
| Payment Trace | `payment` | **Working** — `PaymentTraceTab.tsx`, payment-first layout |
| Journal Integrity | `journal` | **Working** — browse-only `JournalIntegrityTab.tsx` (no void/repair UI) |
| Repair Queue | `repair` | **Working locally** — dry-run previews + **confirm-gated sequence sync** (see safety) |

### Placeholders / not implemented

| Item | Status |
|------|--------|
| Opening Balance | **Placeholder** — disabled in tab bar |
| Audit Log | **Placeholder** — disabled in tab bar |
| `PhaseCTabShell.tsx` | **Unused** for live tabs; kept for reference |
| Safe COA inline edit (name/description/is_active) | **Not implemented** in COA Health tab |
| `developer_repair_plans` migration / unified audit log view | **Not implemented** |
| Read-only RPCs (`rpc_coa_health_snapshot`, etc.) | **Not implemented** — client-side facades only |

### Verification (tonight)

- `npm run test:unit` — **50/50 pass**
- `npm run build` — **pass** (local disk includes uncommitted `roznamchaDedupe.ts` + `rentalPaymentRef.ts` `isRcvReference`)

---

## 2. Safety warning

**Repair Queue (Phase D/E) exists locally.**

Before any deploy or merge to `main`:

1. **Audit all write-capable buttons** in `RepairQueueTab.tsx` and `accountingDeveloperCenterService.ts` (`applySafeSequenceSync`).
2. **Do not** run sequence sync or any repair without explicit typed confirm phrase and role check.
3. **Do not** use Developer Center for void, OB sync, JE amount changes, or GL repairs — those remain in **Developer Integrity Lab** only.
4. Consider **hiding or further gating** Repair Queue tab until product sign-off (Opening Balance / Audit Log stay disabled by design).

Confirm phrase for sequence sync (if ever approved): `SYNC-SEQUENCE-TO-EFFECTIVE-MAX`  
Roles allowed in UI: super-admin, developer (via `canonRole`).

---

## 3. Known problem — clean build on GitHub/main

**C2 Roznamcha deploy/build failure** was caused by **missing committed dependencies**:

| File | Issue |
|------|--------|
| `src/app/services/roznamchaDedupe.ts` | Imported by `roznamchaService.ts` but was **local-only / untracked** on main |
| `src/app/lib/rentalPaymentRef.ts` | Missing export `isRcvReference` used by dedupe |

**Tonight's WIP commit includes these files** so a clone of the WIP branch should build.  
**Before any deployment:** run `npm run build` on a **fresh checkout** of the intended merge branch (no local-only files).

---

## 4. What to do tomorrow (step-by-step)

1. `git fetch origin`
2. `git checkout wip/accounting-developer-center-local-handoff`
3. `git pull` (if pushed tonight)
4. `npm run test:unit`
5. `npm run build` (clean — confirms roznamcha deps committed)
6. `npm run dev` → open `/admin/accounting-developer-center`
7. Manual smoke:
   - `?tab=coa`
   - `?tab=trace&q=HQ-RCV-0006`
   - `?tab=roznamcha&q=HQ-RCV-0006`
   - `?tab=statement&q=HQ-RCV-0006`
   - `?tab=daybook&q=JE-0188`
   - `?tab=payment&q=HQ-RCV-0006`
   - `?tab=journal`
   - `?tab=repair` — **read only**; do not click Apply unless testing in dev DB
8. **Audit Repair Queue write paths** — grep `apply`, `sync`, `void`, `repair` under `developer-center/`
9. **Decide:** keep Repair Queue visible, hide tab, or super-admin-only
10. **Only after local approval:** split clean PRs or merge plan; then deploy — **not before**

---

## 5. Commands for tomorrow

```bash
git status --short
git branch --show-current
npm run test:unit
npm run build
```

Optional deep-link checks (browser, admin/dev role):

```
/admin/accounting-developer-center?tab=roznamcha&q=HQ-RCV-0006
/admin/accounting-developer-center?tab=statement&q=HQ-RCV-0006
/admin/accounting-developer-center?tab=repair
```

---

## 6. Files in this WIP commit (indicative)

See commit message `chore(accounting): save local developer center handoff` on branch `wip/accounting-developer-center-local-handoff`.

**Explicitly left unstaged** (unrelated local WIP): mobile IPAs, migrations, date picker changes, graphify output, POS/sales/rental/report refactors, VPS/deploy files — see final handoff report `git status --short` count.

---

## 7. Plan reference

Full plan: `.cursor/plans/coa_developer_center_eb2d4e9e.plan.md` (do not edit)  
Phase docs: `docs/accounting/coa-developer-center/00`–`05`, `99_LEGACY_TOOLS_CLEANUP_PLAN.md`
