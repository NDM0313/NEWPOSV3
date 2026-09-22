# MOBILE REPORTS PARITY IMPLEMENTATION — NO APK RELEASE WITHOUT APPROVAL

You are continuing OLD ERP / DIN Collection ERP from the OFFICE MACHINE.

**Run name:** MOBILE REPORTS PARITY IMPLEMENTATION — NO APK RELEASE WITHOUT APPROVAL

**Prerequisite:** Operator must explicitly approve mobile implementation. Do not proceed without approval text in the user message.

**Baseline (already complete):**

- Web BS/P&L unified main loaders LIVE @ `db499995` for DIN CHINA, DIN BRIDAL, DIN COUTURE
- Evidence: `reports/post-bs-pl-swap-stability-mobile-readiness-20260701/`
- `origin/main` synced; monitoring PASS; 328/328 unified-ledger; 122/122 unit

---

## Hard constraints

- Do **NOT** run DB migrations
- Do **NOT** mutate GL, journals, payments, sales, purchases, inventory, contacts, accounts, balances
- Do **NOT** change production feature flags (web flags are source of truth)
- Do **NOT** change Cash Flow flags
- Do **NOT** run R8 legacy retirement
- Do **NOT** post supplier party_discount JE or PKR 1 QA
- Do **NOT** build or release APK unless operator gives **separate written APK approval**
- Do **NOT** stage `.env`, credentials, `graphify-out/`, `downloads/`, unrelated monitoring timestamps

---

## Task 1 — Repo safety and sync

```bash
git status --short
git branch --show-current
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git pull --ff-only origin main   # if behind
```

Verify on `main`, no staged credentials.

Create: `reports/mobile-reports-parity-implementation-YYYYMMDD/repo-safety.md` + `.json`

---

## Task 2 — Baseline monitoring and tests

```bash
npm run monitor:three-company-unified-ledger
npm run test:unified-ledger
npm run test:unit
```

Expected: all three companies PASS, Admin Compare 9/9, `migrations_run false`, `gl_mutations false`.

Create: `reports/mobile-reports-parity-implementation-YYYYMMDD/baseline-monitoring.md` + `.json`

---

## Task 3 — Mobile code audit (read-only first)

Audit:

- `erp-mobile-app/src/components/accounts/reports/`
- `erp-mobile-app/src/api/reports.ts`, `accounts.ts`, `roznamcha.ts`
- Web reference: `src/app/lib/accounting/resolve*MainLoaderSource.ts`, `bsPlUnifiedMainService.ts`
- `erp-flutter-app/` only if Flutter phase approved

Document gaps vs web unified reports: Ledger V2, Account Statement, TB, Cash Flow, BS, P&L, Party Ledger.

Create: `reports/mobile-reports-parity-implementation-YYYYMMDD/mobile-code-audit.md` + `.json`

---

## Task 4 — Implement report parity (Capacitor primary)

**Only if safe and approved.**

1. Port shared flag resolution (read `feature_flags` — no writes)
2. Implement screens matching web unified loaders when flags ON
3. Legacy fallback when flags OFF
4. Role gates: Admin / Manager / Salesman (hide balances per web)
5. Print/share: reuse `CompanyBrand` + existing mobile patterns

**Data source policy:** Mobile totals must match web production for DIN CHINA / DIN BRIDAL / DIN COUTURE:

| Company | BS Assets | P&L Net |
|---------|-----------|---------|
| DIN CHINA | 89,754,087.52 | 8,465,730.87 |
| DIN BRIDAL | 13,521,792 | 119,992 |
| DIN COUTURE | 22,667,273 | -16,750 |

---

## Task 5 — Local tests / analyze / build

```bash
cd erp-mobile-app
npm run build:mobile
npm test   # if present

cd ..
npm run test:unified-ledger
npm run test:unit
npm run build
```

Flutter (optional): `flutter analyze`, `flutter test` in `erp-flutter-app/`

Create: `reports/mobile-reports-parity-implementation-YYYYMMDD/tests-build.md` + `.json`

---

## Task 6 — QA matrix (no production GL mutation)

Manual or scripted read-only QA per company + salesman restricted view.

Create: `reports/mobile-reports-parity-implementation-YYYYMMDD/qa-matrix.md` + `.json`

---

## Task 7 — Docs update

Update handoff docs with mobile parity status. Do not claim APK released unless approved.

---

## Task 8 — Commit and push (no APK artifacts)

Stage only:

- `reports/mobile-reports-parity-implementation-YYYYMMDD/**`
- Changed mobile source under `erp-mobile-app/` (and Flutter only if in scope)
- Updated docs

Commit message example:

```
feat(mobile): add unified financial report parity (no apk release)
```

```bash
git push origin main
```

Create: `reports/mobile-reports-parity-implementation-YYYYMMDD/git-push-result.md` + `.json`

---

## Task 9 — APK release gate (BLOCKED by default)

**STOP** unless operator message includes explicit APK release approval.

If approved separately:

- Follow `docs/MOBILE_RELEASE_PLAN.md`, `docs/infra/MOBILE_APK_LOCKED_PATTERN.md`
- Version bump, `cap:sync`, build APK, document rollback APK path
- No production flag or GL changes during APK build

---

## Final response template

Return:

- Status: COMPLETE / BLOCKED
- Screens implemented
- QA vs web goldens
- Tests/build result
- APK status: **NOT RELEASED** unless separately approved
- Evidence commit + push verify
- Next action: stable monitoring / R8 still blocked 2–4 weeks / Supplier PKR 1 separate approval

---

**Do not** use this prompt without operator approval for mobile implementation.
