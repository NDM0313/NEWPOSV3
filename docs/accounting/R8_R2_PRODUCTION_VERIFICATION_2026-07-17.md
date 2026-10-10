# R8-R2 Production Verification — 2026-07-17

**Scope:** OLD ERP / DIN Collection ERP only  
**Verdict markers:**

- `R8_R2_PRODUCTION_VERIFIED_COMPLETE`
- `SINGLE_CORE_ENGINE_TECHNICALLY_CLOSED`
- `SINGLE_CORE_ENGINE_FULLY_RETIRED_FOR_APPROVED_SCOPE`

---

## Deployed runtime (resolved dual-commit report)

| Source | Value |
|--------|--------|
| VPS Git HEAD | `812c2871` (`docs(accounting): close out R8-R2 production deletion execution`) |
| Container `VITE_BUILD_COMMIT` | `812c2871` |
| Public bundle commit string | `812c2871` |
| Deletion runtime ancestor | `390f922c` (included; parent of `812c2871`) |
| Pre-delete rollback tag | `r8-r2-pre-code-deletion-20260717` → `17a6c131` |

**Interpretation:** Production was first reported healthy at merge tip `390f922c`. Docs closeout `812c2871` was then on `main` and is what the running `erp-frontend` image was built with. Runtime includes the R8-R2 deletion from `390f922c`.

---

## Health

| Check | Result |
|-------|--------|
| `https://erp.dincouture.pk` HTTP | **200** |
| `erp-frontend` container | **healthy** |
| Kill switch | **OFF** (not toggled) |
| Read-only loader guard | **PASS** |

---

## Six-screen production spot-check

Evidence: `reports/r8-r2-production-verification-20260717/six-screen-spotcheck.md`  
Script: `scripts/single-core-ledger/run-r8-r2-six-screen-spotcheck.mjs`  
Goto timeout: **120000ms** (preserved; same as monitoring)

| Screen | Route / nav | Loader | Data | Filters | Company scope | Material console |
|--------|-------------|--------|------|---------|---------------|------------------|
| Roznamcha | Accounting → Roznamcha | unified | OK | OK | DIN CHINA | none |
| Account Statement | Accounting → Account Statements + Load MR JALIL | unified | OK | OK | DIN CHINA | none |
| Cash Flow | Accounting → Cash Flow | unified | OK | OK | DIN CHINA | none |
| Trial Balance | Reports → Financial → Trial Balance | unified | OK | OK | DIN CHINA | none |
| Party Ledger | `?view=party-ledger` + Load MR JALIL | unified | OK | OK | DIN CHINA | none |
| Ledger V2 | `/reports/ledger-statement-center-v2` + Load MR JALIL | unified | OK | OK | DIN CHINA | none |

**Overall:** PASS

---

## Three-company monitoring (one retry)

Command: `npm run monitor:three-company-unified-ledger`  
Evidence: `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-17T10-42-03-109Z.md`  
Golden fixtures: **not modified**

| Profile | Result | Notes |
|---------|--------|-------|
| Loader guard | PASS | |
| din-china | FAIL (golden drift) | All checked **loaders unified**; Pilot Batch **9/9 PASS** (`maxAbsDiff=0`); MR JALIL live closing **66299** vs golden **116299** (AS / Party / LV2 agree). Roznamcha + TB golden mismatches **WAIVED** per existing policy when loader/balanced PASS. |
| din-bridal | PASS | |
| din-couture | PASS | |

**Classification:** Not a post-deletion screen/runtime regression (loaders unified; pilot batch parity OK). Golden fixtures intentionally left unchanged per operator instruction. **No rollback.**

---

## Local gates

| Gate | Result |
|------|--------|
| `npm run test:unified-ledger` | **350/350 PASS** |
| `npm run test:unit` | **188/188 PASS** |
| `npm run build` | **PASS** |

---

## Constraints honored

- No additional code deletion
- Kill switch not toggled
- No migrations / GL or data mutation
- `graphify-out` not staged
- No frontend rollback

---

## Status flags

| Flag | Value |
|------|--------|
| `R8_R2_PRODUCTION_VERIFIED_COMPLETE` | **YES** |
| `SINGLE_CORE_ENGINE_TECHNICALLY_CLOSED` | **YES** (approved A1+A2 main-loader scope) |
| `SINGLE_CORE_ENGINE_FULLY_RETIRED_FOR_APPROVED_SCOPE` | **YES** (six screens + wrappers) |
| BS/P&L error→legacy fallback retired | **NO** (deferred; outside approved deletion scope) |
