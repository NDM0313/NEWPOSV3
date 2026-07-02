# Office → Home final handoff — Single Core Ledger

**Generated:** 2026-06-30 (updated 2026-07-01 — DIN BRIDAL monitoring golden refresh complete)  
**Branch:** `main` @ golden refresh evidence (pending push)

---

## 1. Repository state

| Item | Value |
|------|-------|
| Branch | `main` |
| HEAD (pre-handoff) | `95a041d7fc206d23bc60aa16f60015fb2c24a293` |

### Evidence commits

| Commit | Description |
|--------|-------------|
| `6dac5ff6` | Create Business OTP Phase B E2E complete |
| `e7f3fea9` | DIN BRIDAL 1100 dry-run approval pack |
| `95a041d7` | DIN BRIDAL 1100 Option C apply |
| *(this run)* | Final handoff + DIN BRIDAL TB golden refresh |

---

## 2. Completed items

- **Party Ledger Discount customer JE** — retained (JE-0003); monitoring aligned
- **Create Business OTP E2E** — COMPLETE (Phase A + B; bootstrap cleanup done)
- **Hostinger SMTP** — active; `ENABLE_EMAIL_AUTOCONFIRM=false`
- **Sender name** — **NDM ERP SYSTEM** (OTP delivered to Gmail Spam, verified)
- **OTP QA Business 2026-06-30** — created after verification; bootstrap cleanup complete
- **DIN BRIDAL 1100 Option C apply** — COMPLETE; control 1100 now zero
- **DIN BRIDAL TB golden fixture refresh** — COMPLETE (July 1 live-activity refresh to PKR 22,390,400)

---

## 3. DIN BRIDAL 1100 correction (production)

| Correction JE | Source | Customer / AR | Amount |
|---------------|--------|---------------|--------|
| **JV-000209** | JE-0155 / HQ-SL-0001 | Miss NAGHMANA RAJA / AR-CUS0056 | PKR 78,750 |
| **JV-000210** | JE-0157 / HQ-SL-0002 | ASIM / AR-CUS0012 | PKR 57,750 |

### Before / after

| Account | Before | After |
|---------|--------|-------|
| Control **1100** | -136,500 | **0.00** |
| **AR-CUS0056** | 113,750 | **35,000** |
| **AR-CUS0012** | 72,750 | **15,000** |

**Evidence:** [`reports/din-bridal-1100-option-c-apply-20260630/`](../reports/din-bridal-1100-option-c-apply-20260630/)

---

## 4. Monitoring status

| Phase | Result | Notes |
|-------|--------|-------|
| Pre-apply (Option C) | PASS | `2026-06-30T14-56-22-198Z` |
| Post-apply (before golden refresh) | FAIL | din-bridal TB golden total only (+136,500 expected) |
| Post-golden refresh (this run) | **PASS** | `2026-06-30T15-27-01-772Z` — all three companies |
| 2026-07-01 mobile Admin QA day | **PASS** (post golden refresh) | roznamcha + TB drift audited; fixture refresh **COMPLETE** |
| DIN BRIDAL July 1 GL audit | **COMPLETE** | Legitimate live activity |
| DIN BRIDAL golden refresh | **COMPLETE** | Fixture-only; operator Nadeem Khan 2026-07-01 |

**DIN BRIDAL monitoring goldens (current):** TB **22,390,400**; roznamcha cash in **2,116,850**; cash out **917,780**; closing **1,199,070** — see [`reports/din-bridal-monitoring-golden-refresh-20260701/`](../reports/din-bridal-monitoring-golden-refresh-20260701/)

---

## 5. Tests / build (this handoff run)

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | 328/328 PASS |
| `npm run test:unit` | 122/122 PASS |
| `npm run build` | PASS |

---

## 6. Remaining tasks (approval-gated)

| Task | Status |
|------|--------|
| **BS/P&L controlled loader swap** | **COMPLETE** — wiring `db499995`, deploy + flags 2026-07-01 |
| Cash Flow 3B-M | LIVE — rollback only with written approval |
| Supplier Party Discount PKR 1 | **Not approved** — separate operator approval required |
| Mobile parity + APK | **PARTIAL_DEVICE_QA** — Admin manual PASS 21/21; Manager/Salesman pending; monitoring **PASS** |
| DIN BRIDAL monitoring drift | **CLOSED** — fixture-only golden refresh complete |
| R8 legacy retirement | **BLOCKED** — 2–4 week stable run required |

**BS/P&L pack:** [`reports/office-resume-bs-pl-approval-20260701/`](../reports/office-resume-bs-pl-approval-20260701/bs-pl-finance-approval-pack.md)

---

## 7. Do-not-do list

- No deploy (unless separate operator approval)
- No migrations
- No Cash Flow / BS/P&L loader swaps without signed approval
- No new GL repairs
- No supplier `party_discount` JE
- No R8 legacy retirement
- No credentials in git
- Do not stage `graphify-out/`, `downloads/`, `erp-flutter-app/releases/`

---

## 8. Continue from home / office

```bash
git pull origin main
npm install   # if package-lock changed
npm run monitor:three-company-unified-ledger
npm run test:unified-ledger
npm run test:unit
npm run build
```

Monitoring credentials: load from `erp-mobile-app/.env` (`$env:MONITORING_*` lines) — **never commit**.

---

## 9. Exact next recommended action

**BS/P&L loader swap COMPLETE** (2026-07-01). **Mobile reports parity CODE COMPLETE** (2026-07-01). **Internal QA debug APK BUILT** 2026-07-01 — not public released; Play Store not released.

**APK artifact (local only, not in git):** `erp-mobile-app/releases/internal-qa/20260701/dincouture-erp-internal-qa-20260701-debug.apk`  
**SHA256:** `8B7FF35AF80B54E011EE4858DE74D9C74B1DCD062DEACA90C127C5B90251BE00`

**Device QA:** **PARTIAL_DEVICE_QA** — Admin PASS 21/21. Manager apply run **blocked** — prompt contained placeholder email `<PUT_OPERATOR_CONTROLLED_EMAIL_HERE>`, not a real address ([`reports/create-temp-manager-qa-user-apply-20260702/`](../reports/create-temp-manager-qa-user-apply-20260702/)).

**Next:** Re-run apply with real `MANAGER_QA_EMAIL=you@yourdomain.com` and enter password at secure keyboard prompt. Then Pixel adb + Salesman password + role QA. No Play Store. Calendar Day 3 on 2026-07-03+. R8 blocked.

---

## 11. Stability Day 1 — web orphan receipt fix (2026-07-01)

- **Issue:** RCV-0081 / RCV-0082 — duplicate failed web customer receipt retries (zero-line JE shells, Rs 45,000 each).
- **Fix:** Code — atomic posting, duplicate guard, orphan detect/hide UI. Production — soft void both orphans (no GL lines).
- **Delete semantics:** Hide from normal operational views; audit history preserved; not physical delete.
- **Monitoring:** Pre-fix PASS; post-fix DIN BRIDAL Roznamcha golden −90k (phantom cash removed — expected after void).
- **Deploy:** Frontend-only fix **not deployed** this run — awaiting operator approval.
- **Evidence:** [`reports/web-payment-orphan-fix-deploy-roznamcha-refresh-20260701/`](../reports/web-payment-orphan-fix-deploy-roznamcha-refresh-20260701/)

---

## 12. Orphan fix deployed + Roznamcha refresh (2026-07-02)

- **Frontend deploy:** COMPLETE @ `6da3387f` via `deploy/vps-build-erp-only.sh`
- **DIN BRIDAL Roznamcha goldens:** Cash In **2,026,850**, Cash Out **917,780**, Closing **1,109,070** (fixture-only; −90k from orphan void)
- **Monitoring:** PASS all three companies after fixture refresh
- **Delete semantics:** soft hide with audit — not physical delete

---

## 10. Key evidence paths

| Run | Path |
|-----|------|
| Final handoff run | [`reports/final-office-home-handoff-20260630/`](../reports/final-office-home-handoff-20260630/) |
| DIN BRIDAL 1100 apply | [`reports/din-bridal-1100-option-c-apply-20260630/`](../reports/din-bridal-1100-option-c-apply-20260630/) |
| DIN BRIDAL dry-run | [`reports/din-bridal-1100-dry-run-approval-20260630/`](../reports/din-bridal-1100-dry-run-approval-20260630/) |
| OTP Phase B | [`reports/create-business-otp-phase-b-verify-20260630/`](../reports/create-business-otp-phase-b-verify-20260630/) |
| Master remaining plan | [`FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md`](FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md) |
| Web orphan receipt fix (stability day 1) | [`reports/web-payment-orphan-receipt-fix-stability-day1-20260701/`](../reports/web-payment-orphan-receipt-fix-stability-day1-20260701/) |
| Office handoff (prior) | [`OFFICE_HANDOFF_2026-06-29_PARTY_DISCOUNT_SIGNUP_OTP_AND_REMAINING_TASKS.md`](OFFICE_HANDOFF_2026-06-29_PARTY_DISCOUNT_SIGNUP_OTP_AND_REMAINING_TASKS.md) |

**Deploy status (BS/P&L):** **DEPLOYED** — frontend-only @ `db499995` via `deploy/vps-build-erp-only.sh` (2026-07-01). `origin/main` @ `42459bde`. No migrations; no GL mutations.
