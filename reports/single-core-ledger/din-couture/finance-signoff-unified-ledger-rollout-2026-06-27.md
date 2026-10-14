# DIN COUTURE — Finance sign-off: staged unified ledger rollout

| Field | Value |
|-------|-------|
| **Approver** | Nadeem Khan |
| **Date** | 2026-06-27 |
| **Target company** | DIN COUTURE |
| **Target company id** | `2ab65903-62a3-4bcf-bced-076b681e9b74` |
| **Program** | OLD ERP / DIN Collection ERP — Single Core Ledger (NOT FX / multi-currency app) |
| **Production** | https://erp.dincouture.pk |

---

## Approval statement

I, **Nadeem Khan**, approve **DIN COUTURE staged unified-ledger rollout** for the OLD ERP, **one step at a time only**:

1. `unified_ledger_pilot`
2. `unified_ledger_engine`
3. Screen preview flags (Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha)
4. Loader flags **one by one** (same five screens, in order)
5. Post-enable monitoring against DIN COUTURE golden fixtures
6. Soak period or explicit accelerated waiver before marking rollout complete

Each stage must have a verified **L1 rollback SQL path** before execution. **Any failed gate stops rollout** immediately; failed stages roll back per playbook.

---

## Approved scope

- Staged feature-flag enablement for **DIN COUTURE only** (`2ab65903-62a3-4bcf-bced-076b681e9b74`)
- Read-only golden capture before enablement
- Browser QA and monitoring against DIN COUTURE golden party **DHARIA** and company-wide Trial Balance / Roznamcha fixtures
- Reference companies **DIN CHINA** and **DIN BRIDAL** must remain unchanged throughout

---

## Explicitly prohibited

This sign-off does **NOT** authorize:

- Bulk enablement of all unified flags or loaders in one step
- Enablement for any company other than DIN COUTURE
- Database migrations (including R7 `roznamcha_payment` RPC migration)
- GL, journal entry, payment, balance, or accounting data mutation
- Changes to FX / multi-currency application code or configuration
- Changes to DIN CHINA or DIN BRIDAL unified loader or screen behavior
- Production frontend deploy unless source/runtime files change (flags-only changes do not require deploy)

---

## Rollback requirement

For every staged step, the matching rollback SQL under `scripts/single-core-ledger/din-couture/dc-rollback-*.sql` must be confirmed before enable SQL runs. On failure, roll back **only the failed stage** unless the playbook requires broader DIN COUTURE loader rollback.

---

## Stop conditions

Rollout stops (no further flag SQL) if any of the following occur:

- Pre-execution read-only audit fails (DIN COUTURE not at 0 flags, DIN CHINA/DIN BRIDAL regression, cross-company loader leakage)
- Golden capture fails
- Pre-enablement tests or build fail
- Any stage verification fails
- Monitoring fails after loaders are enabled
- Other-company unified loader flag turns ON unexpectedly

---

## Evidence linkage

- Golden fixtures: `reports/single-core-ledger/din-couture/golden-fixtures.json` → `finance_sign_off_ref` points to this file
- SQL pack: `scripts/single-core-ledger/din-couture/dc-*.sql`

---

**Signed:** Nadeem Khan  
**Role:** Operator / Finance approver  
**Effective:** 2026-06-27
