# Office Handoff — 2026-06-29

Party Ledger Discount + Create Business OTP deploy, QA, cleanup, and remaining tasks.

---

## 1. Current git status

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD | `1486e79d` |
| origin/main | `1486e79d` (in sync) |

### Latest pushed commits

| Commit | Description |
|--------|-------------|
| `ae6c69d0` | Party Ledger Discount + Create Business OTP feature merge |
| `22b7089e` | Mac sync audit and active task register |
| `cca0c246` | Local browser QA evidence |
| `31149d5d` | Production deploy/smoke evidence |
| `1486e79d` | Production QA test business cleanup evidence |

### Working tree note (local only — not committed)

- `graphify-out/` — local graphify updates
- `downloads/` — local downloads
- `erp-flutter-app/releases/` — local APK artifacts

---

## 2. Completed tasks

### A. Party Ledger Discount feature

- Code merged on `main`.
- Customer/supplier discount UI added in Ledger Statement Center / Ledger V2.
- Discount transaction filter added.
- `party_discount` row mapping added.
- Service posts JE with intended directions:
  - **Customer discount:** Dr 5200 / Cr AR or customer account
  - **Supplier discount:** Dr AP or supplier account / Cr 5210
- Local UI QA: **PASS**
- Production UI smoke: **PARTIAL PASS** (customer modal on QA company; DIN CHINA parties need office credentials)
- Actual JE posting: **NOT performed** on production

### B. Create Business email OTP

- Signup OTP service integrated (`authSignupService.ts`).
- Wizard phases implemented: `steps` → `otp` → `creating`.
- Business creation runs after authenticated session (`completeBusinessCreationAfterAuth`).
- Local UI QA: **partial** (wizard steps PASS; OTP verify blocked by email access)
- Production entry point smoke: **PASS**
- OTP end-to-end: **not fully verified** (email access required)

### C. Production frontend deploy

- Deployed commit `cca0c246` to https://erp.dincouture.pk
- Frontend-only deploy (`deploy/vps-build-erp-only.sh`)
- No migrations
- No feature flags
- No GL/data mutations
- `erp-frontend`: **healthy**

### D. QA test business cleanup

- `admin@test.com` test signup created production bootstrap data during browser QA.
- Cleanup approved and completed (`1486e79d` evidence).
- **Deleted:**
  - auth user / identity
  - public user/profile
  - QA Test Business Mac company (`d7dac58b-a731-42cb-bc26-0bf7a1b8e292`)
  - branch
  - contacts (walk-in default flag cleared first)
  - accounts (36 COA bootstrap)
  - bootstrap rows (products, sequences, modules, settings, etc.)
- **Confirmed before delete:**
  - 0 sales
  - 0 purchases
  - 0 payments
  - 0 journal entries
  - 0 expenses
  - 0 rentals
  - no GL/business transaction mutation
  - DIN CHINA / DIN BRIDAL / DIN COUTURE unchanged

### E. Tests/build

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | 298/298 PASS |
| `npm run test:unit` | 122/122 PASS |
| `npm run build` | PASS |

---

## 3. Monitoring status

- Full `npm run monitor:three-company-unified-ledger` was **blocked on Mac** because `QA_BROWSER_PASSWORD_CHINA` / `QA_BROWSER_PASSWORD_BRIDAL` / `QA_BROWSER_PASSWORD_COUTURE` are not set on Home MacBook.
- Read-only loader guard **PASS**:
  - DIN CHINA: 6 loaders
  - DIN BRIDAL: 6 loaders
  - DIN COUTURE: 6 loaders
  - Other companies: 0

### Office next action (monitoring)

Run full monitoring from office machine where `QA_BROWSER_PASSWORD_*` exists:

```bash
npm run monitor:three-company-unified-ledger
```

Save evidence under a new dated report folder.

---

## 4. Remaining tasks for office

### Priority 1 — Full monitoring from office

- Run: `npm run monitor:three-company-unified-ledger`
- Expected:
  - din-china PASS
  - din-bridal PASS
  - din-couture PASS
  - other-company loaders 0
  - migrations_run false
  - gl_mutations false
- Save evidence under a new report folder.

### Priority 2 — Controlled Party Ledger Discount JE posting QA

**Do not post automatically.** Operator must approve:

- Company: preferably DIN CHINA
- Party: known customer/supplier (e.g. MR JALIL / MR DIN MOHAMMAD)
- Amount: small test amount, e.g. PKR 1
- Date
- Rollback/reversal plan

QA checks:

- Post one customer discount only after approval
- Verify JE direction (Dr 5200, Cr AR)
- Verify `reference_type = party_discount`
- Verify ledger statement reloads via `ledgerUpdated`
- Verify Discount filter shows row
- Verify Account Statement / Ledger V2 impact
- Document rollback/reversal if required

### Priority 3 — Create Business OTP full QA

- Use an operator-controlled email with inbox access.
- Verify:
  - signup
  - OTP receive
  - OTP verify
  - session poll
  - business creation after auth
  - duplicate prevention
- Cleanup test business/user after QA if created.

### Priority 4 — Cash Flow loader swap remains blocked

- Phase 3B-L readiness pack complete.
- Phase 3B-M **NOT approved** for further execution without separate written operator approval.
- Do not execute Cash Flow loader swap.
- Do not toggle `unified_ledger_loader_cash_flow`.
- Do not create/enable Cash Flow loader flags without approved phase.

### Priority 5 — BS/P&L loader swap

- BS/P&L finance remains **PENDING**.
- Do not approve or swap loader without separate finance/operator sign-off.

### Priority 6 — R7/R8/4th company

- R7 roznamcha_payment RPC: design-only / blocked.
- R8 legacy engine retirement: blocked.
- 4th company unified ledger rollout: needs separate finance sign-off.

### Priority 7 — Accounting / GL backlog requiring fresh diagnostics

Do not repair/apply directly. Items to revalidate:

- MURAD DC-0007 Rs 257,140
- AZIZ JAMURAD 1100 mismatch
- ABDUL WAJID partial mismatch
- DIN BRIDAL control 1100 -136,500

Required before any repair:

- fresh diagnostic query
- dry-run report
- operator approval
- audit evidence
- then minimal repair only if approved

### Priority 8 — Business/UI QA backlog

- REN-0005 Amount Due KPI
- Reports header date reload: BS, TB, P&L, Customers & Suppliers
- Product Reports pie overlap
- Customers & Suppliers Due/Advance GL table QA
- Expenses receipt upload + edit without duplicate
- Sales/Purchases/Inventory KPI strips

### Priority 9 — DIN CHINA import backlog

- 12 products missing cost_price
- Purchase CSV delta around Rs 464k
- Optional sell returns import
- Opening/fabric stock from Oct 2023 excluded by design

### Priority 10 — Mobile backlog

- Rental AR sub-ledger on mobile booking flow
- APK rebuild if needed

---

## 5. Do-not-do list

- Do not deploy unless separate operator approval.
- Do not run migrations.
- Do not toggle feature flags.
- Do not run Cash Flow loader swap.
- Do not post `party_discount` JE without explicit approval.
- Do not run GL repairs from old backlog without fresh diagnostics.
- Do not use stale Phase 1.5 handoff as active roadmap.
- Do not commit `graphify-out/`, `downloads/`, `erp-flutter-app/releases/`, or credentials.

---

## 6. Exact next office action

1. Pull latest `main` at office (`git pull origin main`).
2. Run full three-company monitoring with `QA_BROWSER_PASSWORD_*` set.
3. Run controlled browser QA for Party Discount and Create Business OTP (DIN CHINA credentials).
4. Ask operator before any JE posting or test-business cleanup.
5. Prepare next deploy/QA evidence only after office checks pass.

---

## Evidence paths (Home Mac)

| Run | Path |
|-----|------|
| Mac sync audit | `reports/mac-home-sync-audit-20260629/` |
| Local browser QA | `reports/local-browser-qa-20260629/` |
| Production deploy/smoke | `reports/production-deploy-party-discount-signup-otp-20260629/` |
| QA test business cleanup | `reports/production-test-business-cleanup-20260629/` |
| Active task register | `docs/accounting/ACTIVE_TASK_REGISTER_2026-06-29_MAC_SYNC.md` |
