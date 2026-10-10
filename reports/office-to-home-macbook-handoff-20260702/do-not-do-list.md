# Do-not-do list — office → MacBook handoff

Until explicitly approved by operator:

| # | Prohibited action |
|---|-------------------|
| 1 | **R8** legacy retirement |
| 2 | **Play Store** upload / public release |
| 3 | **DB migrations** (unless separately scoped and approved) |
| 4 | **GL repairs** or business data mutation |
| 5 | **Fixture refresh** without operator approval |
| 6 | **Credentials in git** — passwords, `.env`, keystore, APK/AAB in commits |
| 7 | **Calendar Day 3 on 2026-07-02** — same-day calendar gate |
| 8 | **Create Manager user** without real email + secure password entry |
| 9 | **Supplier Party Discount** QA without separate approval |

## Safe to continue on MacBook

- Read-only git pull / handoff docs
- Calendar Day 3 monitoring when local date ≥ 2026-07-03
- Manager create via `create-erp-user` after operator provides email/password
- ADB device checks after Pixel connected
- Role device QA after credentials ready
