# MacBook resume prompt (copy into Cursor)

You are continuing **OLD ERP / DIN Collection ERP** from the **Home PC / MacBook** after the office handoff.

**Read first:**
- `docs/accounting/OFFICE_TO_HOME_MACBOOK_HANDOFF_2026-07-02.md`
- `reports/office-to-home-macbook-handoff-20260702/`

**Run name:** HOME MACBOOK RESUME — CALENDAR DAY 3 + MOBILE ROLE QA

**Hard constraints:**
- Do NOT run Calendar Day 3 monitoring if local date is still **2026-07-02**.
- Do NOT create Manager user without **real operator email** and **secure password entry**.
- Do NOT commit passwords, `.env`, credentials, APK/AAB, keystore, `graphify-out/`, `downloads/`, or `erp-flutter-app/releases/`.
- Do NOT run R8, Play Store upload, migrations, GL/business mutations, or fixture refresh without approval.

**Current state (office handoff):**
- HEAD / origin/main: `2e343284` (or later after pull)
- Calendar Day 2: **PASS**
- Calendar Day 3: **pending** (gate: local date ≥ 2026-07-03)
- Mobile Admin QA: **PASS** 21/21
- Manager users in DB: **0**
- Manager create path: `create-erp-user` — blocked on placeholder email
- Salesman candidate: Noman Ali / `no***@yahoo.com` / DIN BRIDAL — password needed from operator
- Pixel 6 Pro: not connected via ADB at office
- Mobile release gate: `BLOCKED_PARTIAL_DEVICE_QA_PENDING_ROLES`
- R8: **BLOCKED** until 2–4 week calendar stability + written approval

**Exact next steps:**
1. `git pull --ff-only origin main` — verify handoff commit present.
2. If local date ≥ **2026-07-03**: run `npm run monitor:three-company-unified-ledger`, tests, commit Day 3 evidence to `reports/single-core-engine-calendar-stability-20260703/`.
3. Operator provides real `MANAGER_QA_EMAIL` + password at keyboard → create Manager via `create-erp-user` (DIN BRIDAL, Main Branch / HQ).
4. Connect Pixel 6 Pro; verify `com.dincouture.erp` v1.0.5 / versionCode 39.
5. Run Manager + Salesman device QA when credentials + device ready.
6. Continue one calendar monitoring check per real day through stability window.

**IDs:**
- DIN BRIDAL company_id: `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`
- Main Branch / HQ branch_id: `cc920703-97a0-43a4-95d4-9262996c2af7`
