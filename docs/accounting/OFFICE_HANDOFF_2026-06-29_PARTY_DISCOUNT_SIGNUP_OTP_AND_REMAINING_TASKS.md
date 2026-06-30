# Office Handoff — 2026-06-29

Party Ledger Discount + Create Business OTP deploy, QA, cleanup, and remaining tasks.

---

## 1. Current git status

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD | `49ac9711` (R1B Admin Compare retained-JE baseline closed) |
| origin/main | in sync |

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
- Production UI QA: **PASS** (DIN CHINA MR JALIL + MR DIN MOHAMMAD supplier modal)
- **Production posting QA: COMPLETE** — JE-0003 retained (PKR 1 customer discount, `party_discount`)
- MR JALIL monitoring golden updated to **PKR 216,299** after operator KEEP decision
- DIN CHINA TB golden updated to **PKR 407,957,272.02** (+PKR 1 from JE-0003)
- **Admin Compare 9/9:** closed via legacy hybrid `party_discount` matcher (`49ac9711`); full monitoring **PASS**
- **No reversal approved** for JE-0003

### B. Create Business email OTP

- Signup OTP service integrated (`authSignupService.ts`).
- Wizard phases implemented: `steps` → `otp` → `creating`.
- Business creation runs after authenticated session (`completeBusinessCreationAfterAuth`).
- Local UI QA: **partial** (wizard steps PASS; OTP verify blocked by email access)
- Production entry point smoke: **PASS**
- **OTP end-to-end (2026-06-30):** **INVESTIGATED** — `k***+1@gmail.com` signed up without inbox OTP (`SIGNUP_AUTO_CONFIRM_ENABLED`); test records **cleaned up**
- Evidence: [`reports/create-business-otp-e2e-qa-20260630/`](../reports/create-business-otp-e2e-qa-20260630/), [`reports/create-business-otp-e2e-retry-20260630/`](../reports/create-business-otp-e2e-retry-20260630/), [`reports/create-business-otp-created-without-email-20260630/`](../reports/create-business-otp-created-without-email-20260630/)

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

- Full `npm run monitor:three-company-unified-ledger` **PASS** (2026-06-30 post-R1B deploy `49ac9711`).
- MR JALIL DIN CHINA golden closing: **PKR 216,299** (retained JE-0003 PKR 1 discount).
- Admin Compare Pilot Batch **9/9 PASS** — legacy hybrid now includes `party_discount` by `reference_id`.
- Read-only loader guard **PASS** — DIN CHINA / BRIDAL / COUTURE only; other companies 0 loaders.
- **No migrations, feature flags, or unapproved GL mutations.**

Evidence:
- [`reports/party-discount-je-posting-qa-20260630/`](../reports/party-discount-je-posting-qa-20260630/)
- [`reports/party-discount-je-keep-closure-20260630/`](../reports/party-discount-je-keep-closure-20260630/)
- [`reports/party-discount-monitoring-drift-closure-20260630/`](../reports/party-discount-monitoring-drift-closure-20260630/)
- [`reports/admin-compare-retained-je-baseline-closure-20260630/`](../reports/admin-compare-retained-je-baseline-closure-20260630/)

---

## 4. Remaining tasks for office

### Priority 1 — Create Business OTP full QA

- **Status:** **BLOCKED on infra** — production `GOTRUE_MAILER_AUTOCONFIRM=true` + fake SMTP bypasses OTP; test user `k***+1@gmail.com` cleaned up
- **Before next signup:** set autoconfirm **false** + configure real SMTP (separate deploy/infra approval)
- Forbidden OTP QA emails: `admin@test.com`, `din@yahoo.com`, `ndm313@yahoo.com`, `zhd@dincouture.pk`
- Verify signup → OTP receive → verify → session poll → business creation → duplicate prevention.

### Priority 2 — Optional supplier-side Party Discount posting QA

- Separate operator approval required (e.g. MR DIN MOHAMMAD, PKR 1).
- **Not approved in JE-0003 phase.**

### Priority 3 — Cash Flow loader swap remains blocked

- Phase 3B-L readiness pack complete.
- Phase 3B-M **NOT approved** for further execution without separate written operator approval.
- Do not execute Cash Flow loader swap.
- Do not toggle `unified_ledger_loader_cash_flow`.
- Do not create/enable Cash Flow loader flags without approved phase.

### Priority 4 — BS/P&L loader swap

- BS/P&L finance remains **PENDING**.
- Do not approve or swap loader without separate finance/operator sign-off.

### Priority 5 — R7/R8/4th company

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

1. **Fix production auth email:** `GOTRUE_MAILER_AUTOCONFIRM=false` + real SMTP — separate infra approval; then re-run OTP E2E with disposable inbox.
2. Do **not** post supplier `party_discount` JE without separate operator approval.

---

## Evidence paths (Home Mac)

| Run | Path |
|-----|------|
| Mac sync audit | `reports/mac-home-sync-audit-20260629/` |
| Local browser QA | `reports/local-browser-qa-20260629/` |
| Production deploy/smoke | `reports/production-deploy-party-discount-signup-otp-20260629/` |
| QA test business cleanup | `reports/production-test-business-cleanup-20260629/` |
| Active task register | `docs/accounting/ACTIVE_TASK_REGISTER_2026-06-29_MAC_SYNC.md` |
