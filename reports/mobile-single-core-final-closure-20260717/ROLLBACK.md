# ROLLBACK.md

1. Do not merge without `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`.
2. Do not create temp QA users without `APPROVE_CREATE_TEMP_MOBILE_QA_USERS`.
3. If temp users are later created: deactivate via approved admin/`create-erp-user` workflow (see `TEMP_QA_USER_PLAN.md`).
4. No migrations / no financial rollback needed from this phase.
5. Leave dirty `main @ 812c2871` untouched.
