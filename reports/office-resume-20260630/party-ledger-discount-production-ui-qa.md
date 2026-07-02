# Party Ledger Discount — production UI QA

**Generated:** 2026-06-30  
**URL:** https://erp.dincouture.pk/reports/ledger-statement-center-v2

---

## Result

**BLOCKED_MISSING_QA_BROWSER_PASSWORDS**

Production browser QA was not executed in this session because `QA_BROWSER_PASSWORD_CHINA` (and related per-company QA passwords) are not set in the current shell. DIN CHINA parties **MR JALIL** and **MR DIN MOHAMMAD** require operator production login.

**No JE posted. No `party_discount` row created. No GL mutation.**

---

## Checks (not run this session)

### Customer flow

| Check | Result |
|-------|--------|
| Ledger V2 / Statement Center loads | **Not run** |
| Select MR JALIL | **Not run** |
| Customer Discount button visible | **Not run** |
| Modal opens | **Not run** |
| Validation works | **Not run** |
| Discount filter visible | **Not run** |
| Close modal without posting | **Not run** |
| Unified preview still works | **Not run** |

### Supplier flow

| Check | Result |
|-------|--------|
| Select MR DIN MOHAMMAD | **Not run** |
| Supplier Discount button visible | **Not run** |
| Modal opens | **Not run** |
| Validation works | **Not run** |
| Close without posting | **Not run** |

---

## Prior evidence (for context)

| Run | Result |
|-----|--------|
| Local browser QA `2026-06-29` | **PASS** — full customer + supplier non-mutating UI |
| Production smoke `2026-06-29` | **PARTIAL** — customer modal on QA company; DIN CHINA parties need office credentials |

---

## Remediation

Set `QA_BROWSER_PASSWORD_CHINA` in PowerShell, open production ERP, repeat non-mutating UI checks, close modals via Cancel only.
