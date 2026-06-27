# DIN BRIDAL — Finance sign-off: staged unified ledger rollout

| Field | Value |
|-------|-------|
| **Approver** | Nadeem Khan |
| **Date** | 2026-06-27 |
| **Target company** | DIN BRIDAL |
| **Target company id** | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` |
| **Program** | OLD ERP / DIN Collection ERP — Single Core Ledger (NOT FX / multi-currency app) |
| **Production** | https://erp.dincouture.pk |

---

## Approval statement

I, **Nadeem Khan**, approve **DIN BRIDAL staged unified-ledger rollout** for the OLD ERP, **one step at a time only**:

1. `unified_ledger_pilot`
2. `unified_ledger_engine`
3. Screen preview flags (Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha)
4. Loader flags **one by one** (same five screens, in order)
5. Post-enable monitoring against DIN BRIDAL golden fixtures
6. Soak period or explicit accelerated waiver before marking R5 complete

Each stage must have a verified **L1 rollback SQL path** before execution. **Any failed gate stops rollout** immediately; failed stages roll back per playbook.

---

## Approved scope

- Staged feature-flag enablement for **DIN BRIDAL only** (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)
- Read-only golden capture before enablement
- Browser QA and monitoring against DIN BRIDAL golden party **MR REHAN ALI** and company-wide Trial Balance / Roznamcha fixtures
- Reference company **DIN CHINA** (`30bd8592-3384-4f34-899a-f3907e336485`) must remain unchanged throughout

---

## Explicitly prohibited

This sign-off does **NOT** authorize:

- Bulk enablement of all unified flags or loaders in one step
- Enablement for any company other than DIN BRIDAL
- Database migrations (including R7 `roznamcha_payment` RPC migration)
- GL, journal entry, payment, balance, or accounting data mutation
- Changes to FX / multi-currency application code or configuration
- Changes to DIN CHINA unified loader or screen behavior
- Production frontend deploy unless source/runtime files change (flags-only changes do not require deploy)

---

## Rollback requirement

For every staged step, the matching rollback SQL under `scripts/single-core-ledger/din-bridal/r5-rollback-*.sql` must be confirmed before enable SQL runs. On failure, roll back **only the failed stage** unless the playbook requires broader DIN BRIDAL loader rollback.

---

## Stop conditions

Rollout stops (no further flag SQL) if any of the following occur:

- Pre-execution read-only audit fails (DIN BRIDAL not at 0 flags, DIN CHINA regression, cross-company loader leakage)
- Golden capture fails
- Pre-enablement tests or build fail
- Any stage verification fails
- Monitoring fails after loaders are enabled
- Other-company unified loader flag turns ON

---

## Distinction from prior remediation sign-off

The 2026-06-23 production remediation CSV (`finance-signoff-production-remediation-2026-06-23.csv`) covered payment/branch remediation only. **This artifact** is the authoritative finance sign-off for **DIN BRIDAL unified ledger staged rollout** (R5).

---

## Evidence linkage

- Golden fixtures: `reports/single-core-ledger/din-bridal/golden-fixtures.json` → `finance_sign_off_ref` points to this file
- Execution playbook: `reports/single-core-ledger/r5-pilot-preflight/r5-din-bridal-execution-playbook.md`
- SQL pack: `scripts/single-core-ledger/din-bridal/r5-*.sql`

---

**Signed:** Nadeem Khan  
**Role:** Operator / Finance approver  
**Effective:** 2026-06-27
