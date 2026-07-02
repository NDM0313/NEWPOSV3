# Office → Home MacBook handoff — 2026-07-02

**Generated:** 2026-07-02 20:32:13 +05:00 (office machine)  
**Purpose:** Resume remaining Single Core stability + mobile role QA on Home PC / MacBook without losing context.

Evidence folder: [`reports/office-to-home-macbook-handoff-20260702/`](../reports/office-to-home-macbook-handoff-20260702/)

---

## 1. Current git state

| Item | Value |
|------|-------|
| Branch | `main` |
| HEAD | `2e343284c1f2bd48842b284c1f2cb848ea6236ef` |
| origin/main | `2e343284c1f2bd48842b284c1f2cb848ea6236ef` |
| In sync | **yes** |

### Latest commits (office session)

| Commit | Message |
|--------|---------|
| `fbfb5fbe` | docs(mobile): prepare role qa unblock pack |
| `6d32b16a` | docs(mobile): prepare temp manager qa user |
| `2e343284` | chore(mobile): create temp manager qa user evidence |

---

## 2. Completed before handoff

- **Single Core stability window** started 2026-07-01.
- **Calendar Day 2 PASS** — artifact `three-company-monitoring-2026-07-02T12-55-47-086Z` (commit `eabab401`).
- **Orphan receipt fix** deployed; Roznamcha goldens refreshed; monitoring restored PASS.
- **Mobile Admin QA PASS** 21/21 on Pixel 6 Pro (operator Nadeem Khan).
- **Mobile role QA unblock pack** complete (`fbfb5fbe`).
- **Temp Manager QA apply** attempted — **blocked** placeholder email (`2e343284`).

---

## 3. Remaining tasks on Home PC / MacBook

### A. Calendar Day 3 monitoring

- Run **only** when local date is **2026-07-03 or later** (not same-day 2026-07-02).
- Evidence folder: `reports/single-core-engine-calendar-stability-20260703/`
- Command: `npm run monitor:three-company-unified-ledger`
- Tests: `npm run test:unified-ledger` and `npm run test:unit`
- Commit: `docs(accounting): record single core engine calendar day 3`
- Prior blocked gate notes: `reports/single-core-engine-calendar-stability-20260703/calendar-gate-blocked-note.md`

### B. Manager QA user creation

- Requires **real operator-controlled email** (not placeholder).
- Password entered **securely at keyboard** — never in chat/git/logs.
- Path: `create-erp-user` edge function (`supabase/functions/create-erp-user/`)
- Role: `manager`
- Company: **DIN BRIDAL** (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)
- Branch: **Main Branch / HQ** (`cc920703-97a0-43a4-95d4-9262996c2af7`)
- Display name: Mobile QA Manager
- **No migration.** **No GL mutation.**

### C. Salesman QA

- Use existing active salesman account — recommended: **Noman Ali** / `no***@yahoo.com` / DIN BRIDAL.
- Password provided securely by operator only.
- No password in git/chat/logs.

### D. Device

- Connect **Pixel 6 Pro** via USB; authorize ADB (`device` state).
- Verify package `com.dincouture.erp` v**1.0.5** / versionCode **39**.
- Checklist: [`reports/mobile-role-qa-unblock-pack-20260702/device-reconnect-checklist.md`](../reports/mobile-role-qa-unblock-pack-20260702/device-reconnect-checklist.md)

### E. Manager / Salesman device QA

- Only after **credentials + device** ready.
- **No Play Store upload.**

### F. R8 legacy retirement

- **BLOCKED** until real **2–4 week calendar** stability window completes + written operator approval.

### G. Supplier Party Discount PKR 1 QA

- **Separate approval** — do not run without explicit scope.

---

## 4. MacBook resume commands

See [`reports/office-to-home-macbook-handoff-20260702/macbook-resume-commands.md`](../reports/office-to-home-macbook-handoff-20260702/macbook-resume-commands.md)

Copy-paste agent prompt: [`reports/office-to-home-macbook-handoff-20260702/macbook-resume-prompt.md`](../reports/office-to-home-macbook-handoff-20260702/macbook-resume-prompt.md)

---

## 5. Do-not-do list

See [`reports/office-to-home-macbook-handoff-20260702/do-not-do-list.md`](../reports/office-to-home-macbook-handoff-20260702/do-not-do-list.md)

- No R8
- No Play Store / public release
- No DB migrations (unless separately approved)
- No GL repairs or business data mutation
- No fixture refresh without operator approval
- No credentials/passwords in git
- **No Calendar Day 3 monitoring on 2026-07-02** (same-day gate)

---

## 6. Key evidence paths

| Topic | Path |
|-------|------|
| Stability execution plan | `docs/accounting/FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md` |
| Calendar Day 2 | `reports/single-core-engine-calendar-stability-20260702/` |
| Calendar Day 3 gate | `reports/single-core-engine-calendar-stability-20260703/` |
| Mobile unblock pack | `reports/mobile-role-qa-unblock-pack-20260702/` |
| Manager create prep | `reports/create-temp-manager-qa-user-20260702/` |
| Manager apply blocked | `reports/create-temp-manager-qa-user-apply-20260702/` |
| Mobile release plan | `docs/MOBILE_RELEASE_PLAN.md` |

---

## 7. Exact next action on MacBook

1. `git pull --ff-only origin main` — confirm HEAD `2e343284` or later.
2. If local date ≥ **2026-07-03**: run Calendar Day 3 monitoring pack.
3. Re-run Manager apply with real `MANAGER_QA_EMAIL` + secure password prompt.
4. Connect Pixel 6 Pro; provide Salesman password; run Manager/Salesman device QA.
5. Continue one calendar monitoring check per real day through stability window.
