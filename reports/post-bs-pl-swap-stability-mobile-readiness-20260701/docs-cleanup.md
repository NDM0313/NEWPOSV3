# Docs cleanup — stale BS/P&L handoff wording

**Result:** PASS

## Files updated

1. `docs/accounting/FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md`
2. `docs/accounting/OFFICE_TO_HOME_FINAL_HANDOFF_2026-06-30.md`
3. `docs/accounting/OFFICE_HANDOFF_2026-06-29_PARTY_DISCOUNT_SIGNUP_OTP_AND_REMAINING_TASKS.md`

## Key corrections

- BS/P&L loader swap: **COMPLETE**
- Frontend deploy: **COMPLETE** @ `db499995`
- Flags enabled: yes (3 companies × 4 keys)
- Evidence: `98d2f4c8`; `origin/main` @ `42459bde`
- Stale **Deploy status: NOT DEPLOYED** → clarified as BS/P&L **DEPLOYED** (or N/A for 1100 GL-only apply)

## Preserved constraints

- No migrations / no GL mutations
- Supplier Party Discount PKR 1 — separate approval
- R8 blocked until 2–4 week stable run
- Cash Flow rollback only with written approval
